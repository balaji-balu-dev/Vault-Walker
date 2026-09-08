import httpx
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_full_platform():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    print("[1] Verifying frontend root serving...")
    r = client.get("/")
    assert r.status_code == 200
    assert "AetherDisk" in r.text or "<!doctype html>" in r.text
    print("    Frontend HTML and static assets served successfully.")

    print("\n[2] Checking initial auth status...")
    r = client.get("/api/auth/status")
    assert r.status_code == 200
    status_data = r.json()
    print(f"    Auth status: initialized={status_data['initialized']}")

    admin_key = ""
    if not status_data["initialized"]:
        print("    Setting up initial root admin account...")
        r = client.post("/api/auth/setup-admin", json={"username": "superadmin", "role": "admin"})
        assert r.status_code == 200
        admin_data = r.json()
        admin_key = admin_data["raw_key"]
        print(f"    Admin initialized! Key: {admin_key[:12]}... (256-bit entropy)")
    else:
        # If already initialized from earlier CLI test, create another user or test login
        print("    System already initialized. Querying users via database helper...")
        from app.database import get_db
        from app.auth import generate_access_key, hash_key
        # Ensure we have an active admin key
        admin_key = generate_access_key()
        k_hash, k_salt = hash_key(admin_key)
        with get_db() as conn:
            conn.execute("UPDATE users SET key_hash = ?, key_salt = ? WHERE role = 'admin' AND is_active = 1", (k_hash, k_salt))
        print("    Active admin key synchronized for automated test.")

    print("\n[3] Testing key-based login...")
    r = client.post("/api/auth/login", json={"key": admin_key})
    assert r.status_code == 200
    login_data = r.json()
    token = login_data["session_token"]
    role = login_data["role"]
    assert role == "admin"
    print(f"    Login successful! Role: {role}, Token: {token[:12]}...")

    auth_headers = {"Authorization": f"Bearer {token}"}

    print("\n[4] Verifying storage and SMART hardware telemetry...")
    r = client.get("/api/system/status", headers=auth_headers)
    assert r.status_code == 200
    sys_health = r.json()
    storage = sys_health["storage"]
    smart = sys_health["smart"]
    print(f"    Storage: {storage['used_bytes']/(1024**3):.2f} GB used / {storage['total_bytes']/(1024**3):.2f} GB total ({storage['percent_used']}%)")
    print(f"    SMART Status: {smart['status']} (Fallback: {smart['is_fallback']})")

    print("\n[5] Testing file explorer and directory navigation...")
    r = client.get("/api/files?path=", headers=auth_headers)
    assert r.status_code == 200
    file_list = r.json()
    items = file_list["items"]
    print(f"    Found {len(items)} items in root storage. Breadcrumbs: {file_list['breadcrumbs']}")

    print("\n[6] Testing file upload...")
    test_content = b"This is a test file uploaded to personal cloud platform."
    files = {"file": ("test_upload.txt", test_content, "text/plain")}
    data = {"target_path": "Documents"}
    r = client.post("/api/files/upload", headers=auth_headers, files=files, data=data)
    assert r.status_code == 200
    print("    File upload successful.")

    print("\n[7] Testing multi-select streaming ZIP download...")
    r = client.post(
        "/api/files/download-zip",
        headers=auth_headers,
        json={"paths": ["Documents/Welcome.txt", "Documents/test_upload.txt"]}
    )
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    zip_bytes = r.content
    assert len(zip_bytes) > 0
    print(f"    Streamed ZIP archive received ({len(zip_bytes)} bytes).")

    print("\n[8] Testing regular user creation and role enforcement...")
    # Admin creates regular user
    r = client.post("/api/admin/users", headers=auth_headers, json={"username": "alice", "role": "user"})
    assert r.status_code == 200
    user_res = r.json()
    alice_key = user_res["raw_key"]
    print(f"    Created regular user 'alice'. Key: {alice_key[:12]}...")

    # Alice logs in
    r_user = client.post("/api/auth/login", json={"key": alice_key})
    assert r_user.status_code == 200
    alice_token = r_user.json()["session_token"]
    alice_headers = {"Authorization": f"Bearer {alice_token}"}
    print("    Alice logged in successfully.")

    # Alice attempts to delete a file -> MUST BE REJECTED with 403 Forbidden!
    r_del = client.post("/api/files/delete", headers=alice_headers, json={"paths": ["Documents/test_upload.txt"]})
    assert r_del.status_code == 403
    print("    Security enforced: Regular user delete attempt rejected with 403 Forbidden.")

    # Alice attempts to access admin audit logs -> MUST BE REJECTED with 403 Forbidden!
    r_audit = client.get("/api/admin/audit-logs", headers=alice_headers)
    assert r_audit.status_code == 403
    print("    Security enforced: Regular user admin endpoint access rejected with 403 Forbidden.")

    print("\n[9] Testing Emergency Remote Access Toggle...")
    # Admin toggles remote mode ON
    r_rem = client.post("/api/admin/remote-mode", headers=auth_headers, json={"enabled": True})
    assert r_rem.status_code == 200
    assert r_rem.json()["remote_mode_enabled"] is True
    print("    Emergency Remote Mode enabled.")

    # Admin toggles remote mode OFF
    r_rem2 = client.post("/api/admin/remote-mode", headers=auth_headers, json={"enabled": False})
    assert r_rem2.status_code == 200
    assert r_rem2.json()["remote_mode_enabled"] is False
    print("    Emergency Remote Mode reverted to LAN-only.")

    print("\n[10] Inspecting Security Audit Trail...")
    r_logs = client.get("/api/admin/audit-logs", headers=auth_headers)
    assert r_logs.status_code == 200
    logs = r_logs.json()
    assert len(logs) > 0
    actions = [l["action"] for l in logs[:6]]
    print(f"    Recent audit actions recorded in SQLite: {actions}")

    # Clean up test file using admin token
    client.post("/api/files/delete", headers=auth_headers, json={"paths": ["Documents/test_upload.txt"]})

    print("\n==========================================================")
    print("  ALL 10 END-TO-END VERIFICATION CHECKS PASSED WITH 100% SUCCESS!")
    print("==========================================================")

if __name__ == "__main__":
    test_full_platform()
