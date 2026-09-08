
# Vault Walker: Personal Remote Disk Access Platform (Cloudflare Tunnel Edition)

A self-hosted, plug-and-play web application that allows an administrator and invited users to browse, upload, and download files directly from a physical hard disk connected to a host machine — over LAN normally, and over the public internet when the admin enables emergency remote access via a Cloudflare Tunnel.

**Zero router port forwarding, no static IP / DDNS management, and no exposed ports** — the host machine only establishes an outbound-only connection to Cloudflare. The backend (and, when enabled, the tunnel) starts only when the admin runs it, and stops when they close it.

---

## Key Features

- **Strict External Disk Only Enforcement**: Locks out the host machine's internal system OS drive (`C:\`) to safeguard host files. Binds all file browsing, upload, and download operations strictly to physically connected external storage devices (USB hard drives, flash drives, external SSDs).
- **Outbound-Only Cloudflare Tunnel**:
  - One-click Start/Stop from the Admin Console.
  - Zero open inbound ports on your home router.
  - Automatic, free edge HTTPS termination via `*.trycloudflare.com` quick tunnels or custom named domains.
  - Clean process teardown: stopping remote mode destroys the public endpoint immediately.
- **Custom Key-Based Authentication**: High-entropy 256-bit cryptographic access keys (`secrets.token_urlsafe(32)`). Stored exclusively as salted `scrypt` hashes. Zero password-reset flow: lost keys are revoked and reissued by the admin. Short-lived signed session tokens with brute-force rate limiting.
- **Strict Role Enforcement**:
  - **Admin**: User management, key rotation/revocation, tunnel start/stop, external drive selector, file browse, upload, download, delete, rename, and security audit log inspection.
  - **Regular User**: Browse and upload only. Cannot rename, delete, move files, or touch tunnel/user controls.
- **Categorized File Explorer**: Dedicated tabs for **Photos & Images**, **Documents**, **Videos & Media**, and **All Files**. Fast search, multi-column sorting (name, date, size), grid/list toggle, drag-and-drop upload, chunked uploads for large files, and streaming ZIP downloads.
- **Media Lightbox & Streamer**: Fullscreen image previews with zoom and rotation, in-browser HTML5 video player, and document content viewer.
- **Storage & SMART Diagnostics**: Real-time disk capacity (`psutil.disk_usage`), temperature, power-on hours, reallocated sector tracking, with graceful fallback if `smartctl` is absent.
- **Full Security Audit Trail**: Complete record of user logins, failed attempts, file transfers, and remote mode tunnel sessions stored in SQLite.

---

## Architecture & Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app & role-enforced routes
│   │   ├── config.py          # Environment settings & dynamic storage root
│   │   ├── database.py        # SQLite schema initialization & config KV store
│   │   ├── models.py          # Pydantic request & response schemas
│   │   ├── auth.py            # 256-bit key generator & scrypt hashing
│   │   ├── security.py        # Role dependencies, rate limiting & session tokens
│   │   ├── disk_manager.py    # Native external drive scanner (ctypes Win32 API)
│   │   ├── disk.py            # psutil metrics & smartctl hardware diagnostics
│   │   ├── files.py           # Path validation, traversal guard & operations
│   │   ├── tunnel_manager.py  # Cloudflare Tunnel subprocess & lifecycle manager
│   │   ├── thumbnails.py      # Pillow thumbnail generator & cache
│   │   ├── zip_stream.py      # Low-memory chunked streaming ZIP generator
│   │   └── audit.py           # Security event & remote access audit logger
│   ├── bin/
│   │   └── cloudflared.exe    # Official Cloudflare Tunnel binary
│   ├── cli.py                 # Administrative CLI tool
│   ├── requirements.txt       # Backend Python dependencies
│   ├── tests/                 # Automated test suite
│   └── Dockerfile             # Multi-stage Linux container with cloudflared
├── frontend/
│   ├── src/
│   │   ├── components/        # UI components (Navbar, AdminPanel, FileGrid, etc.)
│   │   ├── services/api.js    # API client
│   │   ├── App.jsx            # Main application layout with developer footer
│   │   └── index.css          # Tailwind styling & glassmorphism
│   ├── dist/                  # Production build served by FastAPI
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml         # Single-command start & stop
├── NETWORKING.md              # Cloudflare Tunnel guide & optional custom domains
├── SETUP.md                   # First-run guide & admin initialization
└── README.md
```

---

## Quickstart

### 1. Run Locally on Host Machine
```bash
# 1. Install dependencies
pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..

# 2. Start Vault Walker
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```
Open `http://localhost:8000` in your web browser.

### 2. Run via Docker Compose
```bash
docker compose up -d
```
Stop anytime with:
```bash
docker compose down
```

---

## Platform Leadership & Development

- **Balaji Nallapati** | CEO | Vault Walker  
- **Edem Chanukya** | CTO | Vault Walker  
