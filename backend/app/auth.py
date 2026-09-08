import hashlib
import secrets
import time
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict
from .config import SESSION_EXPIRY_HOURS, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_ATTEMPTS
from .database import get_db

# In-memory sliding window for login rate-limiting: ip -> list of timestamps
_login_failed_attempts: Dict[str, list] = {}

def generate_access_key() -> str:
    """Generates a 256-bit cryptographically random token."""
    return f"key_{secrets.token_urlsafe(32)}"

def hash_key(raw_key: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hashes the raw key using scrypt with a random 16-byte salt."""
    if not salt:
        salt_bytes = secrets.token_bytes(16)
        salt_hex = salt_bytes.hex()
    else:
        salt_hex = salt
        salt_bytes = bytes.fromhex(salt_hex)
    
    # 512-bit key derivation using scrypt
    derived = hashlib.scrypt(
        raw_key.encode("utf-8"),
        salt=salt_bytes,
        n=16384,
        r=8,
        p=1,
        maxmem=64 * 1024 * 1024,
        dklen=64
    )
    return derived.hex(), salt_hex

def verify_key(raw_key: str, stored_hash: str, stored_salt: str) -> bool:
    """Verifies a raw key against stored salted hash in constant time."""
    candidate_hash, _ = hash_key(raw_key, stored_salt)
    return secrets.compare_digest(candidate_hash, stored_hash)

def check_rate_limit(ip_address: str) -> bool:
    """Returns True if IP is within allowed limits, False if rate-limited."""
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    attempts = _login_failed_attempts.get(ip_address, [])
    # Filter attempts within window
    recent = [t for t in attempts if t > cutoff]
    _login_failed_attempts[ip_address] = recent
    return len(recent) < RATE_LIMIT_MAX_ATTEMPTS

def record_failed_attempt(ip_address: str) -> None:
    now = time.time()
    attempts = _login_failed_attempts.setdefault(ip_address, [])
    attempts.append(now)

def clear_failed_attempts(ip_address: str) -> None:
    if ip_address in _login_failed_attempts:
        _login_failed_attempts.pop(ip_address, None)

def create_session(user_id: int, ip_address: str, user_agent: str, is_remote: bool) -> Tuple[str, str]:
    """Creates a new session in SQLite and returns (token, expires_at_iso)."""
    token = f"sess_{secrets.token_urlsafe(32)}"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=SESSION_EXPIRY_HOURS)
    expires_at_iso = expires_at.isoformat()
    now_iso = now.isoformat()

    with get_db() as conn:
        conn.execute("""
            INSERT INTO sessions (token, user_id, created_at, expires_at, ip_address, user_agent, is_remote)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (token, user_id, now_iso, expires_at_iso, ip_address, user_agent, 1 if is_remote else 0))

    return token, expires_at_iso

def get_session_user(token: str) -> Optional[dict]:
    """Retrieves the authenticated user dict from session token if valid and not expired."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        row = conn.execute("""
            SELECT u.id, u.username, u.role, u.is_active, s.expires_at, s.is_remote
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ? AND u.is_active = 1
        """, (token, now_iso)).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "role": row["role"],
                "is_active": bool(row["is_active"]),
                "expires_at": row["expires_at"],
                "is_remote": bool(row["is_remote"])
            }
    return None

def delete_session(token: str) -> None:
    with get_db() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
