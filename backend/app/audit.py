from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from .database import get_db

def log_audit_event(
    action: str,
    username: Optional[str] = None,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    is_remote: bool = False,
    details: Optional[str] = None
) -> None:
    """Records an audit event into SQLite."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        conn.execute("""
            INSERT INTO audit_logs (user_id, username, action, ip_address, is_remote, details, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?);
        """, (user_id, username, action, ip_address, 1 if is_remote else 0, details, now_iso))

def get_audit_logs(limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
    """Retrieves recent audit logs for administrative inspection."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT id, user_id, username, action, ip_address, is_remote, details, timestamp
            FROM audit_logs
            ORDER BY id DESC
            LIMIT ? OFFSET ?;
        """, (limit, offset)).fetchall()

        return [
            {
                "id": r["id"],
                "user_id": r["user_id"],
                "username": r["username"] or "Anonymous",
                "action": r["action"],
                "ip_address": r["ip_address"] or "Unknown",
                "is_remote": bool(r["is_remote"]),
                "details": r["details"] or "",
                "timestamp": r["timestamp"]
            }
            for r in rows
        ]
