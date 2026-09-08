import hashlib
import os
from pathlib import Path
from typing import Optional
from PIL import Image, ImageOps
from .config import THUMBNAIL_CACHE_DIR

def get_or_create_thumbnail(image_path: Path, size=(256, 256)) -> Optional[Path]:
    """
    Generates and caches a thumbnail for an image file.
    Cache key incorporates file path and mtime to refresh when file changes.
    """
    if not image_path.exists() or image_path.is_dir():
        return None

    try:
        mtime = image_path.stat().st_mtime
        key_src = f"{image_path.resolve()}_{mtime}_{size[0]}x{size[1]}"
        cache_filename = hashlib.sha256(key_src.encode("utf-8")).hexdigest() + ".webp"
        cache_path = THUMBNAIL_CACHE_DIR / cache_filename

        if cache_path.exists():
            return cache_path

        # Generate thumbnail with Pillow
        with Image.open(str(image_path)) as img:
            # Handle orientation from EXIF
            img = ImageOps.exif_transpose(img)
            
            # Convert RGBA / P to RGB if saving as WebP or preserve transparency
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA")
                
            img.thumbnail(size, Image.Resampling.LANCZOS)
            img.save(str(cache_path), "WEBP", quality=80)

        return cache_path
    except Exception:
        return None
