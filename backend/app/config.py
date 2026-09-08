import os
import secrets
from pathlib import Path

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent

# Configurable storage root path
STORAGE_ROOT_ENV = os.getenv("STORAGE_ROOT")
if STORAGE_ROOT_ENV:
    STORAGE_ROOT = Path(STORAGE_ROOT_ENV).resolve()
else:
    STORAGE_ROOT = (PROJECT_ROOT / "storage_disk").resolve()

# Database & cache directories
DATA_DIR = (BASE_DIR / "data").resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "app.db"
THUMBNAIL_CACHE_DIR = DATA_DIR / "thumbnails"
THUMBNAIL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
CHUNKS_TEMP_DIR = DATA_DIR / "upload_chunks"
CHUNKS_TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Ensure storage root exists
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

# Security and session settings
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32))
SESSION_EXPIRY_HOURS = int(os.getenv("SESSION_EXPIRY_HOURS", "24"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "300"))
RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("RATE_LIMIT_MAX_ATTEMPTS", "5"))

# Server bind settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
