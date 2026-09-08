import sys
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import init_db, get_db
from app.auth import generate_access_key, hash_key
from app.disk import get_storage_metrics, get_smart_diagnostics

def init_admin(username: str = "admin"):
    init_db()
    with get_db() as conn:
        existing = conn.execute("SELECT id, username FROM users WHERE role = 'admin' AND is_active = 1").fetchone()
        if existing:
            print(f"[!] An active administrator already exists: '{existing['username']}' (ID: {existing['id']})")
            print("    Use 'python cli.py create-user' or 'python cli.py revoke-key' instead.")
            return

        raw_key = generate_access_key()
        k_hash, k_salt = hash_key(raw_key)
        now_iso = datetime.now(timezone.utc).isoformat()

        cur = conn.execute("""
            INSERT INTO users (username, key_hash, key_salt, role, created_at, is_active)
            VALUES (?, ?, ?, 'admin', ?, 1);
        """, (username, k_hash, k_salt, now_iso))
        
        print("=" * 64)
        print("  PERSONAL REMOTE DISK ACCESS PLATFORM — INITIAL ADMIN SETUP")
        print("=" * 64)
        print(f"Administrator Created : {username}")
        print(f"User ID               : {cur.lastrowid}")
        print(f"Access Key (SAVE NOW) : {raw_key}")
        print("=" * 64)
        print("CRITICAL: This access key is 256-bit entropy and will NOT be shown again.")
        print("Only its salted hash is stored in the database.")
        print("=" * 64)

def create_user(username: str, role: str = "user"):
    init_db()
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            print(f"[-] Error: User '{username}' already exists.")
            return

        raw_key = generate_access_key()
        k_hash, k_salt = hash_key(raw_key)
        now_iso = datetime.now(timezone.utc).isoformat()

        cur = conn.execute("""
            INSERT INTO users (username, key_hash, key_salt, role, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, 1);
        """, (username, k_hash, k_salt, role, now_iso))

        print(f"[+] User created successfully: {username} (Role: {role})")
        print(f"    Access Key: {raw_key}")

def revoke_key(username: str):
    init_db()
    with get_db() as conn:
        user = conn.execute("SELECT id, username, role FROM users WHERE username = ?", (username,)).fetchone()
        if not user:
            print(f"[-] Error: User '{username}' not found.")
            return

        new_key = generate_access_key()
        k_hash, k_salt = hash_key(new_key)
        
        # Terminate all active sessions
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
        conn.execute("UPDATE users SET key_hash = ?, key_salt = ? WHERE id = ?", (k_hash, k_salt, user["id"]))

        print(f"[+] Key revoked and rotated for '{username}'")
        print(f"    New Access Key: {new_key}")

def list_users():
    init_db()
    with get_db() as conn:
        users = conn.execute("SELECT id, username, role, created_at, is_active FROM users ORDER BY id ASC").fetchall()
        print("\n--- Registered Platform Users ---")
        print(f"{'ID':<4} {'Username':<20} {'Role':<10} {'Status':<10} {'Created At'}")
        print("-" * 65)
        for u in users:
            status = "Active" if u["is_active"] else "Disabled"
            print(f"{u['id']:<4} {u['username']:<20} {u['role']:<10} {status:<10} {u['created_at'][:19]}")
        print("-" * 65 + "\n")

def show_status():
    storage = get_storage_metrics()
    smart = get_smart_diagnostics()
    print("\n--- Disk & System Telemetry ---")
    total_gb = storage['total_bytes'] / (1024**3)
    used_gb = storage['used_bytes'] / (1024**3)
    free_gb = storage['free_bytes'] / (1024**3)
    print(f"Mount Point   : {storage['mount_point']}")
    print(f"Capacity      : {total_gb:.2f} GB total | {used_gb:.2f} GB used ({storage['percent_used']}%) | {free_gb:.2f} GB free")
    print(f"SMART Status  : {smart['status']} ({'Fallback mode' if smart['is_fallback'] else 'Hardware active'})")
    if smart.get("temperature_c"):
        print(f"Temperature   : {smart['temperature_c']} C")
    if smart.get("power_on_hours"):
        print(f"Power-on Hours: {smart['power_on_hours']} hrs")
    print("-------------------------------\n")

def main():
    parser = argparse.ArgumentParser(description="Personal Remote Disk Access Platform - Administrative CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    init_p = subparsers.add_parser("init-admin", help="Create the initial administrator account")
    init_p.add_argument("--username", default="admin", help="Admin username (default: admin)")

    create_p = subparsers.add_parser("create-user", help="Create a new user")
    create_p.add_argument("username", help="New username")
    create_p.add_argument("--role", default="user", choices=["admin", "user"], help="User role")

    revoke_p = subparsers.add_parser("revoke-key", help="Revoke and rotate user access key")
    revoke_p.add_argument("username", help="Username to rotate key for")

    subparsers.add_parser("list-users", help="List all users")
    subparsers.add_parser("status", help="Show disk capacity and SMART diagnostics")

    args = parser.parse_args()
    if args.command == "init-admin":
        init_admin(args.username)
    elif args.command == "create-user":
        create_user(args.username, args.role)
    elif args.command == "revoke-key":
        revoke_key(args.username)
    elif args.command == "list-users":
        list_users()
    elif args.command == "status":
        show_status()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
