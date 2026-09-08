import os
import re
import shutil
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional, Dict, Any
from .config import BASE_DIR
from .database import get_config_value, set_config_value
from .audit import log_audit_event

_tunnel_process: Optional[subprocess.Popen] = None
_tunnel_lock = threading.Lock()
_tunnel_status = "OFFLINE"  # "OFFLINE" | "STARTING" | "ONLINE" | "ERROR"
_tunnel_url: Optional[str] = None
_tunnel_start_time: Optional[float] = None
_tunnel_error: Optional[str] = None
_tunnel_log_lines: list = []

def get_cloudflared_path() -> Optional[str]:
    """Finds the cloudflared binary on the host machine."""
    # 1. Check local backend/bin directory
    local_bin = (BASE_DIR / "bin" / ("cloudflared.exe" if os.name == "nt" else "cloudflared")).resolve()
    if local_bin.exists():
        return str(local_bin)

    # 2. Check system PATH
    system_which = shutil.which("cloudflared")
    if system_which:
        return system_which

    # 3. Check common program locations
    common_paths = [
        r"C:\Program Files\Cloudflare\cloudflared.exe",
        r"C:\Program Files (x86)\Cloudflare\cloudflared.exe",
        "/usr/local/bin/cloudflared",
        "/usr/bin/cloudflared",
    ]
    for p in common_paths:
        if os.path.exists(p):
            return p

    return None

def _monitor_tunnel_output(proc: subprocess.Popen):
    """Background thread reading stderr from cloudflared to extract public URL."""
    global _tunnel_status, _tunnel_url, _tunnel_error, _tunnel_log_lines
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    while proc.poll() is None:
        line = proc.stderr.readline()
        if not line:
            break
        text = line.strip()
        if text:
            _tunnel_log_lines.append(text)
            if len(_tunnel_log_lines) > 50:
                _tunnel_log_lines.pop(0)

            # Search for trycloudflare URL
            match = url_pattern.search(text)
            if match:
                extracted_url = match.group(0)
                _tunnel_url = extracted_url
                _tunnel_status = "ONLINE"
                set_config_value("tunnel_public_url", extracted_url)

    # If process exits
    returncode = proc.poll()
    if returncode is not None and returncode != 0 and _tunnel_status != "OFFLINE":
        _tunnel_status = "ERROR"
        _tunnel_error = f"cloudflared exited unexpectedly with code {returncode}."
        set_config_value("tunnel_public_url", "")

def start_cloudflared_tunnel(token: Optional[str] = None) -> Dict[str, Any]:
    """
    Launches a Cloudflare Tunnel subprocess.
    If token is provided, runs a configured Named Tunnel.
    Otherwise, runs a free ephemeral Quick Tunnel exposing port 8000.
    """
    global _tunnel_process, _tunnel_status, _tunnel_url, _tunnel_start_time, _tunnel_error, _tunnel_log_lines

    with _tunnel_lock:
        if _tunnel_process and _tunnel_process.poll() is None:
            return get_cloudflared_status()

        bin_path = get_cloudflared_path()
        if not bin_path:
            _tunnel_status = "ERROR"
            _tunnel_error = "cloudflared binary is not installed on host."
            return {
                "is_running": False,
                "status": "ERROR",
                "error_message": _tunnel_error,
                "binary_available": False
            }

        _tunnel_status = "STARTING"
        _tunnel_url = None
        _tunnel_error = None
        _tunnel_log_lines = []
        _tunnel_start_time = time.time()

        if token and token.strip():
            cmd = [bin_path, "tunnel", "run", "--token", token.strip()]
        else:
            # Free quick tunnel exposing 8000
            cmd = [
                bin_path, "tunnel",
                "--url", "http://127.0.0.1:8000",
                "--no-autoupdate"
            ]

        try:
            # Launch cloudflared with stderr redirected
            _tunnel_process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            )

            # Start thread to capture public URL
            thread = threading.Thread(target=_monitor_tunnel_output, args=(_tunnel_process,), daemon=True)
            thread.start()

            set_config_value("remote_mode_enabled", "true")

            # Wait briefly up to 6 seconds for URL to become available
            start_wait = time.time()
            while time.time() - start_wait < 6:
                if _tunnel_url or _tunnel_status == "ERROR":
                    break
                time.sleep(0.3)

            return get_cloudflared_status()

        except Exception as e:
            _tunnel_status = "ERROR"
            _tunnel_error = str(e)
            return {
                "is_running": False,
                "status": "ERROR",
                "error_message": _tunnel_error,
                "binary_available": True
            }

def stop_cloudflared_tunnel() -> Dict[str, Any]:
    """Gracefully terminates the cloudflared process and tears down public access."""
    global _tunnel_process, _tunnel_status, _tunnel_url, _tunnel_start_time, _tunnel_error

    with _tunnel_lock:
        if _tunnel_process:
            try:
                _tunnel_process.terminate()
                try:
                    _tunnel_process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    _tunnel_process.kill()
            except Exception:
                pass
            _tunnel_process = None

        _tunnel_status = "OFFLINE"
        _tunnel_url = None
        _tunnel_start_time = None
        _tunnel_error = None

        set_config_value("remote_mode_enabled", "false")
        set_config_value("tunnel_public_url", "")

        return get_cloudflared_status()

def get_cloudflared_status() -> Dict[str, Any]:
    """Retrieves real-time status of the Cloudflare Tunnel."""
    global _tunnel_process, _tunnel_status, _tunnel_url, _tunnel_start_time, _tunnel_error

    bin_path = get_cloudflared_path()
    is_alive = bool(_tunnel_process and _tunnel_process.poll() is None)

    if not is_alive and _tunnel_status == "ONLINE":
        _tunnel_status = "OFFLINE"
        _tunnel_url = None

    uptime = 0
    if is_alive and _tunnel_start_time:
        uptime = int(time.time() - _tunnel_start_time)

    return {
        "is_running": is_alive,
        "status": _tunnel_status if is_alive else ("ERROR" if _tunnel_status == "ERROR" else "OFFLINE"),
        "public_url": _tunnel_url if is_alive else None,
        "uptime_seconds": uptime,
        "binary_available": bin_path is not None,
        "binary_path": bin_path,
        "error_message": _tunnel_error,
        "recent_logs": _tunnel_log_lines[-10:] if _tunnel_log_lines else []
    }
