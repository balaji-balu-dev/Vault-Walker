import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Generator, Optional, Any, Dict, List
from .config import DB_PATH

_lock = threading.Lock()

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(
        str(DB_PATH),
        timeout=30.0,
        check_same_thread=False,
        isolation_level=None  # autocommit mode
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
    finally:
        conn.close()

def init_db() -> None:
    with _lock, get_db() as conn:
        # Users table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                key_hash TEXT NOT NULL,
                key_salt TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            );
        """)

        # Sessions table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                is_remote INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        """)

        # System Config table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Audit Logs table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT,
                action TEXT NOT NULL,
                ip_address TEXT,
                is_remote INTEGER NOT NULL DEFAULT 0,
                details TEXT,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            );
        """)

        # Set default system config values if absent
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("""
            INSERT OR IGNORE INTO system_config (key, value, updated_at)
            VALUES ('remote_mode_enabled', 'false', ?);
        """, (now,))
        conn.execute("""
            INSERT OR IGNORE INTO system_config (key, value, updated_at)
            VALUES ('system_initialized', 'false', ?);
        """, (now,))

# Config helper functions
def get_config_value(key: str, default: str = "") -> str:
    with get_db() as conn:
        row = conn.execute("SELECT value FROM system_config WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

def set_config_value(key: str, value: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO system_config (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;
        """, (key, value, now))
