import io
import zipfile
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
import sys

# Ensure backend path is on sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import app
from app.auth import generate_access_key, hash_key, verify_key
from app.files import safe_resolve_path, get_file_category
from app.disk_manager import get_active_storage_root
from app.security import is_private_ip
from app.disk import get_storage_metrics, get_smart_diagnostics
from app.database import set_config_value, init_db, get_db

@pytest.fixture(autouse=True)
def setup_test_db():
    init_db()

def test_key_generation_and_hashing():
    key = generate_access_key()
    assert key.startswith("key_")
    assert len(key) >= 32

    h, s = hash_key(key)
    assert len(h) == 128  # 64 bytes in hex
    assert len(s) == 32  # 16 bytes in hex

    assert verify_key(key, h, s) is True
    assert verify_key("wrong_key_1234567890123456", h, s) is False

def test_path_traversal_protection():
    # Valid relative path inside storage root
    root = get_active_storage_root()
    resolved = safe_resolve_path("")
    assert resolved.exists()
    assert str(resolved) == str(root)

    # Attempting to escape via ..
    with pytest.raises(Exception):
        safe_resolve_path("../../Windows/System32")

    with pytest.raises(Exception):
        safe_resolve_path("Documents/../../../etc/passwd")

def test_file_categories():
    assert get_file_category(Path("photo.jpg")) == "image"
    assert get_file_category(Path("document.pdf")) == "document"
    assert get_file_category(Path("movie.mp4")) == "video"
    assert get_file_category(Path("backup.tar.gz")) == "other"

def test_private_ip_detection():
    # LAN and local loopback
    assert is_private_ip("127.0.0.1") is True
    assert is_private_ip("192.168.1.50") is True
    assert is_private_ip("10.0.0.1") is True
    assert is_private_ip("172.16.0.1") is True
    assert is_private_ip("::1") is True

    # Public Internet IPs
    assert is_private_ip("8.8.8.8") is False
    assert is_private_ip("1.1.1.1") is False
    assert is_private_ip("93.184.216.34") is False

def test_disk_metrics_and_smart_fallback():
    storage = get_storage_metrics()
    assert storage["total_bytes"] > 0
    assert 0 <= storage["percent_used"] <= 100

    smart = get_smart_diagnostics()
    assert "status" in smart
    assert "is_fallback" in smart
    assert isinstance(smart["attributes"], list)

def test_streaming_zip_generation():
    from app.zip_stream import stream_zip_files
    from app.disk_manager import get_active_storage_root
    
    root = get_active_storage_root()
    test_file = root / "test_zip_sample.txt"
    test_file.write_text("Hello from streaming zip", encoding="utf-8")
    
    try:
        chunks = list(stream_zip_files(["test_zip_sample.txt"]))
        zip_bytes = b"".join(chunks)
        assert len(zip_bytes) > 0
        
        # Verify it is a valid zip archive readable by zipfile
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            names = zf.namelist()
            assert "test_zip_sample.txt" in names
    finally:
        if test_file.exists():
            test_file.unlink()
