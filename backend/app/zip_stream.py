import io
import os
import zipfile
from pathlib import Path
from typing import List, Generator
from .files import safe_resolve_path

class ChunkBuffer(io.RawIOBase):
    """
    A file-like object that buffers writes and allows pulling out yielded chunks,
    enabling streaming zip generation without buffering the entire archive in RAM.
    """
    def __init__(self):
        self._buffer = bytearray()

    def writable(self) -> bool:
        return True

    def write(self, b) -> int:
        self._buffer.extend(b)
        return len(b)

    def read_chunks(self) -> bytes:
        data = bytes(self._buffer)
        self._buffer.clear()
        return data

def stream_zip_files(rel_paths: List[str], disk_identifier: str = None) -> Generator[bytes, None, None]:
    """
    Yields byte chunks of a standard ZIP archive containing the requested files/directories.
    Never buffers the complete archive in RAM, keeping memory footprint low.
    """
    buf = ChunkBuffer()
    # Use ZIP_DEFLATED compression
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel in rel_paths:
            target = safe_resolve_path(rel, disk_identifier)
            if not target.exists():
                continue

            if target.is_file():
                arcname = target.name
                # Stream file in 64KB chunks into the zip archive
                with open(target, "rb") as f:
                    with zf.open(arcname, "w") as dest:
                        while chunk := f.read(65536):
                            dest.write(chunk)
                            yielded = buf.read_chunks()
                            if yielded:
                                yield yielded
            elif target.is_dir():
                base_dir_name = target.name
                for root, dirs, files in os.walk(str(target)):
                    for f in files:
                        file_path = Path(root) / f
                        rel_to_target = file_path.relative_to(target).as_posix()
                        arcname = f"{base_dir_name}/{rel_to_target}"
                        with open(file_path, "rb") as src:
                            with zf.open(arcname, "w") as dest:
                                while chunk := src.read(65536):
                                    dest.write(chunk)
                                    yielded = buf.read_chunks()
                                    if yielded:
                                        yield yielded

    # Yield remaining zip metadata (central directory headers, end of central directory)
    final_data = buf.read_chunks()
    if final_data:
        yield final_data
