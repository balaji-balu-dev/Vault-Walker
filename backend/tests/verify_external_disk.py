import httpx

def main():
    client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=5.0)
    
    # Login
    r = client.post("/api/auth/login", json={"key": "key_YkLQdiZXC9-hwtcqkfLMg7BVtviIwmWYTb52L0mzUNc"})
    assert r.status_code == 200, r.text
    token = r.json()["session_token"]
    h = {"Authorization": f"Bearer {token}"}

    # System status
    sys_status = client.get("/api/system/status", headers=h).json()
    active_disk = sys_status["active_external_disk"]
    storage = sys_status["storage"]
    print(f"[+] Active External Disk : {active_disk['label']} ({active_disk['drive_letter']})")
    print(f"[+] Connection Type      : {active_disk['bus_type']} ({active_disk['filesystem']})")
    print(f"[+] Capacity             : {storage['used_bytes'] / (1024**3):.2f} GB used / {storage['total_bytes'] / (1024**3):.2f} GB total ({storage['percent_used']}%)")

    # Files on external disk
    files_res = client.get("/api/files?path=", headers=h).json()
    items = files_res["items"]
    print(f"[+] Root Items on Disk   : {len(items)} found")
    print("\nSample items from your external hard disk:")
    for item in items[:10]:
        kind = "DIR " if item["is_dir"] else "FILE"
        print(f"  [{kind}] {item['name']}")

if __name__ == "__main__":
    main()
