# Vault Walker — Setup & Operations Guide

Welcome to **Vault Walker: Personal Remote Disk Access Platform (Cloudflare Tunnel Edition)**.

This guide details first-run initialization, external disk requirements, user management, and running the platform.

---

## 1. System Requirements

- **Operating System:** Windows 10/11, Linux, or macOS.
- **Python:** 3.11 or newer (`python --version`).
- **Storage:** A physically connected external storage device (USB hard drive, external SSD, or USB flash drive).
  - *Security Enforcement:* Vault Walker locks out the host machine's internal system OS drive (`C:\`) to protect personal system files. File operations are bound exclusively to connected external disks.
- **Remote Access (Optional):** Pre-bundled `cloudflared.exe` is included in `backend/bin/`. No router port forwarding or Cloudflare paid account required.

---

## 2. Quickstart: Starting the Server

### Option A: Local Python & Node Execution (Recommended for Host Machine)

#### Step 1: Install Python Dependencies
```bash
# In the project root directory:
pip install -r backend/requirements.txt
```

#### Step 2: Build the Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```
*The FastAPI backend automatically serves the production bundle from `frontend/dist` on port 8000.*

#### Step 3: Launch Vault Walker
```bash
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Open your browser to:
```text
http://localhost:8000
```

---

### Option B: Docker Compose (Single Command Start / Stop)

```bash
# Start Vault Walker in the background:
docker compose up -d

# Stop Vault Walker and tear down:
docker compose down
```

---

## 3. External Disk Auto-Detection & Storage Root

Vault Walker features a native hardware disk detection engine:
- When launched, it scans connected drives and excludes internal fixed system drives (`C:\`).
- If an external USB drive (e.g. `D:\ ZENITSU`) is plugged in, Vault Walker mounts it automatically and makes it the active storage root.
- If multiple external drives are connected, the Admin can switch between them seamlessly using the drive selector in the top navigation bar.
- If no external drive is plugged in, the system enters an alert state prompting the user to attach external storage.

You can also override the storage root manually by setting the `STORAGE_ROOT` environment variable:
```powershell
$env:STORAGE_ROOT = "D:\"
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

---

## 4. Initial Administrator Key Generation

Vault Walker uses a key-based cryptographic authentication model (256-bit entropy via `secrets.token_urlsafe`). There is no password-reset flow.

### First-Run Web Setup:
1. Open `http://localhost:8000` in your web browser.
2. If no administrator account exists, the **Initial Setup Required** card appears.
3. Enter your desired administrator username (e.g., `superadmin`) and click **Generate Admin Key**.
4. **Copy and save the displayed 256-bit key immediately.** For maximum security, the raw key is never stored in the database—only its salted hash is retained.

### Command Line Setup (CLI):
You can also initialize the root admin directly from your terminal:
```bash
python backend/cli.py init-admin --username superadmin
```

---

## 5. Emergency Remote Access (Cloudflare Tunnel)

1. Log into Vault Walker with your admin key.
2. Open the **Admin Console** and navigate to the **Cloudflare Tunnel** tab.
3. Click **Start Quick Tunnel**:
   - Vault Walker launches `cloudflared` in the background.
   - Cloudflare allocates a secure `https://*.trycloudflare.com` address.
   - The live HTTPS URL is displayed with a one-click copy button.
4. Share the link with authorized users—they must authenticate using their cryptographic key.
5. Click **Stop Tunnel** when finished to tear down the public endpoint immediately.

---

## 6. Offline User & Key Management CLI

The included administrative CLI tool allows offline user management:

- **List all users and roles:**
  ```bash
  python backend/cli.py list-users
  ```

- **Create a regular user (browse & upload only):**
  ```bash
  python backend/cli.py create-user alice --role user
  ```

- **Revoke and rotate a lost key:**
  ```bash
  python backend/cli.py revoke-key alice
  ```

- **Check storage capacity & SMART diagnostics:**
  ```bash
  python backend/cli.py status
  ```

---

## 7. Stopping the Application

Vault Walker is designed to run only when you need it:
- In terminal: Press `Ctrl + C`.
- In Docker: Run `docker compose down`.
- Any active Cloudflare Tunnel process is automatically stopped and killed upon shutdown.
- All files, user hashes, sessions, and security audit records persist in SQLite (`backend/data/app.db`).

---

### Platform Leadership & Development

- **Balaji Nallapati** | CEO | Vault Walker  
- **Edem Chanukya** | CTO | Vault Walker  
