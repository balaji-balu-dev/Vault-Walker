import requests

def test_full_system():
    BASE = 'http://127.0.0.1:8000'

    # 1. HTML Bundle
    r_html = requests.get(f'{BASE}/')
    assert r_html.status_code == 200, f'HTML failed: {r_html.status_code}'
    assert 'Vault Walker' in r_html.text or 'assets/index' in r_html.text
    print('[PASS] Frontend bundle served correctly')

    # 2. Login
    ADMIN_KEY = 'key_YkLQdiZXC9-hwtcqkfLMg7BVtviIwmWYTb52L0mzUNc'
    r_login = requests.post(f'{BASE}/api/auth/login', json={'key': ADMIN_KEY})
    assert r_login.status_code == 200, f'Login failed: {r_login.status_code} {r_login.text}'
    token = r_login.json()['session_token']
    headers = {'Authorization': f'Bearer {token}'}
    print(f"[PASS] Login successful, role={r_login.json().get('role')}")

    # 3. System status with concurrency stats
    r_status = requests.get(f'{BASE}/api/system/status', headers=headers)
    assert r_status.status_code == 200
    status_data = r_status.json()
    print('[PASS] Status:', {
        'active_transfers': status_data.get('active_transfers'),
        'active_sessions_count': status_data.get('active_sessions_count'),
        'external_disks_count': len(status_data.get('external_disks', []))
    })
    assert 'active_transfers' in status_data
    assert 'active_sessions_count' in status_data

    # 4. Refresh external disks
    r_ref = requests.post(f'{BASE}/api/system/external-disks/refresh', headers=headers)
    assert r_ref.status_code == 200
    ref_data = r_ref.json()
    disks = ref_data.get('external_disks', [])
    print(f'[PASS] Disks refreshed: {len(disks)} found')
    for d in disks:
        total_gb = round(d.get('size_bytes', 0) / (1024**3), 2)
        free_gb = round(d.get('free_bytes', 0) / (1024**3), 2)
        print(f"   -> Disk: {d.get('friendly_name')} ({d.get('mount_point')}) Total: {total_gb}GB, Free: {free_gb}GB")

    # 5. Files listing with pagination and disk parameter
    target_disk = disks[0]['mount_point'] if disks else None
    r_files = requests.get(f'{BASE}/api/files', params={'disk': target_disk, 'limit': 10, 'offset': 0}, headers=headers)
    assert r_files.status_code == 200
    fdata = r_files.json()
    print('[PASS] Files query with pagination:', {
        'current_path': fdata.get('current_path'),
        'disk': fdata.get('disk'),
        'item_count': len(fdata.get('items', [])),
        'total_count': fdata.get('total_count'),
        'has_more': fdata.get('has_more'),
        'limit': fdata.get('limit'),
        'offset': fdata.get('offset')
    })

    # 6. Test download streaming
    if fdata.get('items'):
        file_item = next((i for i in fdata['items'] if not i['is_dir']), None)
        if file_item:
            r_dl = requests.get(f'{BASE}/api/files/download', params={'path': file_item['path'], 'disk': target_disk}, headers=headers, stream=True)
            assert r_dl.status_code == 200
            chunk = next(r_dl.iter_content(chunk_size=1024))
            print(f"[PASS] Download stream verified: received {len(chunk)} bytes from {file_item['name']}")

    # 7. Test traversal attack safety
    r_bad = requests.get(f'{BASE}/api/files', params={'path': '../../Windows/System32', 'disk': target_disk}, headers=headers)
    assert r_bad.status_code in [400, 403], f'Expected 400/403 for path traversal, got {r_bad.status_code}'
    print('[PASS] Path traversal safely rejected with HTTP', r_bad.status_code)

    print('ALL SYSTEM VERIFICATIONS PASSED!')

if __name__ == '__main__':
    test_full_system()
