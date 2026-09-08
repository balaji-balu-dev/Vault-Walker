# Vault Walker — Networking & Cloudflare Tunnel Guide

This guide details how **Vault Walker** manages local network access (LAN) and on-demand emergency remote access using **Cloudflare Tunnel (`cloudflared`)**.

---

## 1. Networking Architecture Overview

Vault Walker eliminates traditional self-hosting complexity:
- **Zero router port forwarding:** Your home Wi-Fi router remains completely closed. No inbound ports (`80`, `443`, `8000`) are ever opened.
- **No static IP or Dynamic DNS required:** You do not need DDNS services (DuckDNS, No-IP) or ISP public IP tracking.
- **Outbound-only connection:** The host machine initiates an outbound-only encrypted connection (QUIC / TLS over HTTP/2) to Cloudflare's edge data centers.
- **Automatic HTTPS:** Cloudflare terminates TLS at edge nodes, providing a public `https://` endpoint with valid SSL certificates at zero cost.
- **On-Demand Lifecycle:** The tunnel is not persistent 24/7. It is launched only when the admin toggles it on, and terminates cleanly when stopped.

```
[Emergency Remote User (Phone/Laptop)]
                │
                │ (Encrypted HTTPS)
                ▼
    [Cloudflare Global Edge Network]
                │
                │ (Outbound-only QUIC/HTTP2)
                ▼
   [Host Machine: cloudflared.exe]
                │
                │ (Internal proxy: http://127.0.0.1:8000)
                ▼
    [Vault Walker FastAPI Backend] ◄───► [Physical External Disk]
```

---

## 2. Default Mode — Local Network (LAN) Access

Under normal operation, Vault Walker runs locally on your home network:
- **Bound address:** `0.0.0.0:8000`
- **LAN Access:** Any PC, Mac, phone, or tablet connected to your local Wi-Fi can access the platform at:
  ```text
  http://<HOST-LAN-IP>:8000
  ```
  *(Example: `http://192.168.1.150:8000`)*
- **Finding your Host LAN IP:**
  - **Windows:** Run `ipconfig` in PowerShell / Command Prompt and check `IPv4 Address`.
  - **macOS:** Check **System Settings > Network > Wi-Fi > Details**.
  - **Linux:** Run `hostname -I` or `ip a`.

LAN connections require the same 256-bit cryptographic key authentication as remote connections — no bypass exists.

---

## 3. Emergency Remote Access via Cloudflare Tunnel

When you leave home and need urgent access to your files, the admin can activate emergency remote mode directly from the **Vault Walker Admin Console**.

### How the App Manages `cloudflared`
1. **Binary Discovery:** Vault Walker automatically locates the `cloudflared` binary:
   - First checks `backend/bin/cloudflared.exe` (included out-of-the-box on Windows).
   - Next checks system `PATH` (`cloudflared` command).
   - Finally checks standard locations (`C:\Program Files\Cloudflare\cloudflared.exe` or `/usr/local/bin/cloudflared`).
2. **Subprocess Execution:** When the admin clicks **Start Quick Tunnel**:
   - Vault Walker executes `cloudflared tunnel --url http://127.0.0.1:8000 --no-autoupdate` as an isolated local child process.
   - A background monitor captures the assigned public address (e.g., `https://random-words.trycloudflare.com`).
3. **Clean Teardown:** When the admin clicks **Stop Tunnel**:
   - The `cloudflared` process is terminated immediately.
   - The public endpoint is dismantled by Cloudflare edge servers.
   - Zero open ports or background processes remain.
4. **Emergency Audit Log:** Every connection made through the tunnel is logged to SQLite with timestamp, user identity, action, and network origin (`REMOTE (IP)`).

---

## 4. Installing `cloudflared` on the Host (Optional Manual Installation)

If you are setting up Vault Walker on a new machine or Linux host:

### Windows
- **Option A (Pre-installed):** Vault Walker ships with `cloudflared.exe` in `backend/bin/`.
- **Option B (Official Installer):** Download the official `.msi` or `.exe` from [Cloudflare Releases](https://github.com/cloudflare/cloudflared/releases/latest) and install.
- **Option C (Winget):**
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```

### Linux (Debian / Ubuntu / Raspberry Pi OS)
```bash
# Download and install the latest deb package
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bullseye main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

### macOS (Homebrew)
```bash
brew install cloudflared
```

Verify installation:
```bash
cloudflared --version
```

---

## 5. Using a Custom Domain (Named Tunnel)

While the default Quick Tunnel gives you a free, instant `*.trycloudflare.com` URL without creating a Cloudflare account, you can also connect a custom domain (e.g. `vault.yourdomain.com`) using Cloudflare's free Zero Trust tier.

### Steps to Set Up a Named Tunnel:
1. Log in to your free [Cloudflare One Dashboard](https://one.dash.cloudflare.com/).
2. Navigate to **Networks > Tunnels** and click **Create a Tunnel**.
3. Choose **Cloudflared** as the connector type and name your tunnel (e.g. `vault-walker`).
4. Copy the provided tunnel **token** (a long base64 string).
5. In your Cloudflare dashboard, add a **Public Hostname**:
   - **Subdomain:** `vault` (or whatever you prefer)
   - **Domain:** `yourdomain.com`
   - **Service Type:** `HTTP`
   - **URL:** `127.0.0.1:8000`
6. In Vault Walker Admin Console, paste your tunnel token into the **Tunnel Token** input and click **Start Tunnel**.
7. Vault Walker will launch `cloudflared` bound to your persistent custom hostname!

---

## 6. Optional Security Layer: Cloudflare Access (Zero Trust)

For maximum security when using a custom domain, you can place **Cloudflare Access** (free for up to 50 users) in front of Vault Walker:
1. In the Cloudflare One dashboard, go to **Access > Applications**.
2. Add an application for your tunnel hostname (`vault.yourdomain.com`).
3. Add a policy that requires one-time PIN email verification (e.g., only allowing your personal email address).
4. **Dual Authentication:** An attacker on the internet must first pass Cloudflare's edge identity verification, and then present a valid Vault Walker 256-bit cryptographic key to unlock disk operations.

---

### Platform Leadership & Development

- **Balaji Nallapati** | CEO | Vault Walker  
- **Edem Chanukya** | CTO | Vault Walker  
