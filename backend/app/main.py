import mimetypes
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, Request, Response, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import STORAGE_ROOT, CHUNKS_TEMP_DIR
from .database import init_db, get_db, get_config_value, set_config_value
from .auth import (
    generate_access_key, hash_key, verify_key, check_rate_limit,
    record_failed_attempt, clear_failed_attempts, create_session,
    delete_session
)
from .security import (
    get_client_ip, is_remote_client, verify_network_access,
    get_current_user, require_admin, require_write_permission,
    get_host_network_info
)
from .disk_manager import (
    get_connected_external_disks, get_active_external_disk,
    set_active_external_disk, refresh_external_disks, get_storage_root_for_disk
)
from .concurrency import TransferSlot, get_active_transfer_stats
from .disk import get_storage_metrics, get_smart_diagnostics
from .files import (
    list_files, safe_resolve_path, create_directory, rename_item,
    delete_items, inspect_file_item
)
from .thumbnails import get_or_create_thumbnail
from .zip_stream import stream_zip_files
from .tunnel_manager import (
    start_cloudflared_tunnel, stop_cloudflared_tunnel, get_cloudflared_status
)
from .audit import log_audit_event, get_audit_logs
from .models import (
    LoginRequest, LoginResponse, UserResponse, CreateUserRequest,
    CreateUserResponse, FileListResponse, CreateFolderRequest,
    RenameRequest, DeleteRequest, ZipDownloadRequest, SystemStatusResponse,
    RemoteModeToggleRequest, SelectDiskRequest, StartTunnelRequest,
    TunnelStatusResponse
)

# Initialize database on startup
init_db()

app = FastAPI(
    title="Vault Walker - Personal Remote Disk Access Platform",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url=None
)

@app.on_event("shutdown")
def on_shutdown():
    # Gracefully stop any active tunnel when the server stops
    stop_cloudflared_tunnel()

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global middleware to enforce emergency remote mode restrictions
@app.middleware("http")
async def network_firewall_middleware(request: Request, call_next):
    # Skip public health / static assets if necessary, but protect all API mutating and data routes
    client_ip = get_client_ip(request)
    is_remote = is_remote_client(request)
    remote_mode_enabled = get_config_value("remote_mode_enabled", "false").lower() == "true"

    if is_remote and not remote_mode_enabled and request.url.path.startswith("/api/"):
        return Response(
            content='{"detail":"Emergency Remote Access is disabled. LAN access only."}',
            status_code=403,
            media_type="application/json"
        )

    response = await call_next(request)
    return response

# ----------------- AUTHENTICATION ROUTES -----------------

@app.get("/api/auth/status")
def get_auth_setup_status():
    """Checks whether an administrator account has already been initialized."""
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND is_active = 1;").fetchone()["c"]
    return {"initialized": count > 0}

@app.post("/api/auth/setup-admin", response_model=CreateUserResponse)
def setup_first_admin(req: CreateUserRequest, request: Request):
    """Initializes the very first administrator account if no users exist."""
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) as c FROM users;").fetchone()["c"]
        if count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="System is already initialized with an admin. Additional accounts must be created by admin."
            )

        raw_key = generate_access_key()
        k_hash, k_salt = hash_key(raw_key)
        now_iso = datetime.now(timezone.utc).isoformat()

        cur = conn.execute("""
            INSERT INTO users (username, key_hash, key_salt, role, created_at, is_active)
            VALUES (?, ?, ?, 'admin', ?, 1);
        """, (req.username, k_hash, k_salt, now_iso))
        user_id = cur.lastrowid

    log_audit_event(
        action="INIT_ADMIN",
        username=req.username,
        user_id=user_id,
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details="Initial administrator account created during setup"
    )

    return CreateUserResponse(
        id=user_id,
        username=req.username,
        role="admin",
        raw_key=raw_key
    )

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, response: Response):
    """
    Key-based authentication.
    - Rate limits failed attempts to stop brute-force against keys.
    - Constant-time salted hash comparison.
    - Issues short-lived session token.
    """
    client_ip = get_client_ip(request)
    is_remote = is_remote_client(request)

    if not check_rate_limit(client_ip):
        log_audit_event(
            action="LOGIN_RATELIMITED",
            ip_address=client_ip,
            is_remote=is_remote,
            details="Rate limit exceeded for key login attempts"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again."
        )

    clean_key = req.key.strip()
    matched_user = None

    with get_db() as conn:
        users = conn.execute("SELECT id, username, key_hash, key_salt, role, is_active FROM users WHERE is_active = 1;").fetchall()
        for u in users:
            if verify_key(clean_key, u["key_hash"], u["key_salt"]):
                matched_user = u
                break

    if not matched_user:
        record_failed_attempt(client_ip)
        log_audit_event(
            action="LOGIN_FAILED",
            ip_address=client_ip,
            is_remote=is_remote,
            details="Invalid access key provided"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Please verify your access key."
        )

    # Successful login
    clear_failed_attempts(client_ip)
    user_agent = request.headers.get("user-agent", "Unknown")
    token, expires_at = create_session(
        user_id=matched_user["id"],
        ip_address=client_ip,
        user_agent=user_agent,
        is_remote=is_remote
    )

    log_audit_event(
        action="LOGIN_SUCCESS",
        username=matched_user["username"],
        user_id=matched_user["id"],
        ip_address=client_ip,
        is_remote=is_remote,
        details=f"Successful login via {'Emergency Remote' if is_remote else 'Local LAN'}"
    )

    # Set secure HTTP-only cookie
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False  # allow LAN HTTP; client can also use Bearer token header
    )

    return LoginResponse(
        session_token=token,
        username=matched_user["username"],
        role=matched_user["role"],
        expires_at=expires_at
    )

@app.post("/api/auth/logout")
def logout(request: Request, response: Response, current_user: dict = Depends(get_current_user)):
    token = request.cookies.get("session_token")
    auth_h = request.headers.get("Authorization")
    if auth_h and auth_h.startswith("Bearer "):
        token = auth_h.split(" ")[1]
    
    if token:
        delete_session(token)
    response.delete_cookie("session_token")

    log_audit_event(
        action="LOGOUT",
        username=current_user["username"],
        user_id=current_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request)
    )
    return {"message": "Logged out successfully"}

@app.get("/api/auth/me")
def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "role": current_user["role"],
        "expires_at": current_user["expires_at"]
    }

# ----------------- ADMIN USER MANAGEMENT -----------------

@app.get("/api/admin/users", response_model=List[UserResponse])
def list_users(admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        rows = conn.execute("SELECT id, username, role, created_at, is_active FROM users ORDER BY id ASC;").fetchall()
        return [
            UserResponse(
                id=r["id"],
                username=r["username"],
                role=r["role"],
                created_at=r["created_at"],
                is_active=bool(r["is_active"])
            )
            for r in rows
        ]

@app.post("/api/admin/users", response_model=CreateUserResponse)
def create_user(req: CreateUserRequest, request: Request, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (req.username,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists.")

        raw_key = generate_access_key()
        k_hash, k_salt = hash_key(raw_key)
        now_iso = datetime.now(timezone.utc).isoformat()

        cur = conn.execute("""
            INSERT INTO users (username, key_hash, key_salt, role, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, 1);
        """, (req.username, k_hash, k_salt, req.role, now_iso))
        new_id = cur.lastrowid

    log_audit_event(
        action="USER_CREATE",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Created new user '{req.username}' with role '{req.role}'"
    )

    return CreateUserResponse(
        id=new_id,
        username=req.username,
        role=req.role,
        raw_key=raw_key
    )

@app.post("/api/admin/users/{user_id}/revoke", response_model=CreateUserResponse)
def revoke_and_rotate_user_key(user_id: int, request: Request, admin_user: dict = Depends(require_admin)):
    with get_db() as conn:
        user = conn.execute("SELECT id, username, role FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        # Generate new key
        new_raw_key = generate_access_key()
        k_hash, k_salt = hash_key(new_raw_key)

        # Invalidate existing sessions
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        # Update user key hash
        conn.execute("UPDATE users SET key_hash = ?, key_salt = ? WHERE id = ?", (k_hash, k_salt, user_id))

    log_audit_event(
        action="KEY_REVOKE_ROTATE",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Revoked existing key and issued new key for user '{user['username']}'"
    )

    return CreateUserResponse(
        id=user["id"],
        username=user["username"],
        role=user["role"],
        raw_key=new_raw_key
    )

@app.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, request: Request, admin_user: dict = Depends(require_admin)):
    if user_id == admin_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own active administrator account.")

    with get_db() as conn:
        user = conn.execute("SELECT id, username FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

    log_audit_event(
        action="USER_DELETE",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Deleted user '{user['username']}' (ID: {user_id})"
    )

    return {"message": f"User '{user['username']}' deleted."}

@app.get("/api/admin/audit-logs")
def view_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin_user: dict = Depends(require_admin)
):
    return get_audit_logs(limit=limit, offset=offset)

@app.post("/api/admin/remote-mode")
def toggle_remote_mode(req: RemoteModeToggleRequest, request: Request, admin_user: dict = Depends(require_admin)):
    val_str = "true" if req.enabled else "false"
    set_config_value("remote_mode_enabled", val_str)

    log_audit_event(
        action="REMOTE_MODE_TOGGLE",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Emergency Remote Mode switched to: {'ENABLED' if req.enabled else 'DISABLED'}"
    )

    return {
        "remote_mode_enabled": req.enabled,
        "message": f"Emergency Remote Mode is now {'ENABLED' if req.enabled else 'DISABLED'}."
    }

# ----------------- FILE OPERATIONS -----------------

@app.get("/api/files", response_model=FileListResponse)
def get_files_list(
    path: str = Query("", description="Relative path from storage root"),
    category: Optional[str] = Query(None, description="Filter: 'image', 'document', 'video', 'other'"),
    search: Optional[str] = Query(None, description="Search query"),
    sort_by: str = Query("name", description="Sort by 'name', 'size', 'date'"),
    sort_order: str = Query("asc", description="'asc' or 'desc'"),
    limit: int = Query(60, ge=1, le=500),
    offset: int = Query(0, ge=0),
    disk: Optional[str] = Query(None, description="External disk letter or mount point"),
    current_user: dict = Depends(get_current_user)
):
    return list_files(
        rel_path=path,
        category_filter=category,
        search_query=search,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
        disk_identifier=disk
    )

@app.get("/api/files/download")
def download_single_file(
    request: Request,
    path: str = Query(..., description="Relative file path"),
    disk: Optional[str] = Query(None, description="External disk letter"),
    inline: bool = Query(False, description="Whether to display inline instead of attachment"),
    current_user: dict = Depends(get_current_user)
):
    file_path = safe_resolve_path(path, disk)
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    token = current_user.get("session_token", current_user.get("username", "anonymous"))
    log_audit_event(
        action="PREVIEW" if inline else "DOWNLOAD",
        username=current_user["username"],
        user_id=current_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"{'Viewed' if inline else 'Downloaded'} file: {path} (Disk: {disk or 'default'})"
    )

    # Stream file in 64KB chunks under managed concurrency transfer slot
    def file_chunk_generator(fp: Path, slot_token: str):
        with TransferSlot(slot_token, "download"):
            with open(fp, "rb") as f:
                while chunk := f.read(65536):
                    yield chunk

    file_size = file_path.stat().st_size
    mime_type, _ = mimetypes.guess_type(str(file_path))
    safe_name = file_path.name.replace('"', '')
    disposition = "inline" if inline else "attachment"

    return StreamingResponse(
        file_chunk_generator(file_path, token),
        media_type=mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'{disposition}; filename="{safe_name}"',
            "Content-Length": str(file_size)
        }
    )

@app.post("/api/files/download-zip")
def download_files_as_zip(
    req: ZipDownloadRequest,
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    if not req.paths:
        raise HTTPException(status_code=400, detail="No files selected for archive.")

    token = current_user.get("session_token", current_user.get("username", "anonymous"))
    log_audit_event(
        action="ZIP_DOWNLOAD",
        username=current_user["username"],
        user_id=current_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Downloaded zip archive containing {len(req.paths)} items (Disk: {req.disk or 'default'})"
    )

    def zip_chunk_generator(paths: List[str], disk_id: Optional[str], slot_token: str):
        with TransferSlot(slot_token, "zip_download"):
            for chunk in stream_zip_files(paths, disk_id):
                yield chunk

    archive_name = f"disk_archive_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_chunk_generator(req.paths, req.disk, token),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{archive_name}"'}
    )

@app.get("/api/files/thumbnail")
def get_thumbnail(
    path: str = Query(...),
    disk: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    file_path = safe_resolve_path(path, disk)
    thumb_path = get_or_create_thumbnail(file_path)
    if not thumb_path or not thumb_path.exists():
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        raise HTTPException(status_code=404, detail="Thumbnail not available.")
    return FileResponse(str(thumb_path), media_type="image/webp")

@app.post("/api/files/upload")
async def upload_direct_file(
    request: Request,
    target_path: str = Form(""),
    disk: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Direct upload handler for standard files."""
    token = current_user.get("session_token", current_user.get("username", "anonymous"))
    with TransferSlot(token, "upload"):
        dest_dir = safe_resolve_path(target_path, disk)
        if not dest_dir.is_dir():
            raise HTTPException(status_code=400, detail="Target destination is not a directory.")

        safe_name = Path(file.filename).name.replace("/", "_").replace("\\", "_")
        final_path = dest_dir / safe_name

        with open(final_path, "wb") as out_f:
            shutil.copyfileobj(file.file, out_f)

        log_audit_event(
            action="UPLOAD",
            username=current_user["username"],
            user_id=current_user["id"],
            ip_address=get_client_ip(request),
            is_remote=is_remote_client(request),
            details=f"Uploaded '{safe_name}' ({final_path.stat().st_size} bytes)"
        )

        return {"message": "File uploaded successfully", "item": inspect_file_item(final_path, get_storage_root_for_disk(disk))}

@app.post("/api/files/upload-chunk")
async def upload_file_chunk(
    request: Request,
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    target_path: str = Form(""),
    disk: Optional[str] = Form(None),
    chunk: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Chunked upload endpoint supporting resumable large file streaming without memory overflow.
    """
    dest_dir = safe_resolve_path(target_path, disk)
    upload_tmp_dir = CHUNKS_TEMP_DIR / upload_id
    upload_tmp_dir.mkdir(parents=True, exist_ok=True)

    chunk_file = upload_tmp_dir / f"chunk_{chunk_index}"
    with open(chunk_file, "wb") as f:
        shutil.copyfileobj(chunk.file, f)

    # Check if all chunks received
    received_chunks = list(upload_tmp_dir.glob("chunk_*"))
    if len(received_chunks) == total_chunks:
        # Assemble final file
        safe_name = Path(filename).name.replace("/", "_").replace("\\", "_")
        final_target = dest_dir / safe_name
        
        with open(final_target, "wb") as outfile:
            for i in range(total_chunks):
                part = upload_tmp_dir / f"chunk_{i}"
                if part.exists():
                    with open(part, "rb") as pf:
                        shutil.copyfileobj(pf, outfile)

        # Clean up chunk directory
        shutil.rmtree(str(upload_tmp_dir), ignore_errors=True)

        log_audit_event(
            action="CHUNK_UPLOAD_COMPLETE",
            username=current_user["username"],
            user_id=current_user["id"],
            ip_address=get_client_ip(request),
            is_remote=is_remote_client(request),
            details=f"Assembled large file '{safe_name}' ({final_target.stat().st_size} bytes)"
        )

        return {"completed": True, "item": inspect_file_item(final_target, get_storage_root_for_disk(disk))}

    return {"completed": False, "chunk_index": chunk_index, "received": len(received_chunks), "total": total_chunks}

@app.post("/api/files/mkdir")
def make_folder(
    req: CreateFolderRequest,
    request: Request,
    admin_user: dict = Depends(require_write_permission)
):
    new_dir = create_directory(req.current_path, req.folder_name, req.disk)
    log_audit_event(
        action="MKDIR",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Created folder: {new_dir.name}"
    )
    return {"message": "Folder created successfully", "item": inspect_file_item(new_dir, get_storage_root_for_disk(req.disk))}

@app.patch("/api/files/rename")
def rename_file_or_folder(
    req: RenameRequest,
    request: Request,
    admin_user: dict = Depends(require_write_permission)
):
    renamed = rename_item(req.old_path, req.new_name, req.disk)
    log_audit_event(
        action="RENAME",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Renamed {req.old_path} -> {renamed.name}"
    )
    return {"message": "Item renamed successfully", "item": inspect_file_item(renamed, get_storage_root_for_disk(req.disk))}

@app.post("/api/files/delete")
def delete_file_or_folder(
    req: DeleteRequest,
    request: Request,
    admin_user: dict = Depends(require_write_permission)
):
    deleted = delete_items(req.paths, req.disk)
    log_audit_event(
        action="DELETE",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Deleted {len(deleted)} item(s): {', '.join(deleted)}"
    )
    return {"message": f"Deleted {len(deleted)} item(s)", "deleted_paths": deleted}

# ----------------- SYSTEM & HARDWARE DIAGNOSTICS -----------------

@app.get("/api/system/status", response_model=SystemStatusResponse)
def get_system_health(
    disk: Optional[str] = Query(None, description="Query storage specifically for this disk"),
    current_user: dict = Depends(get_current_user)
):
    storage = get_storage_metrics(disk_identifier=disk)
    smart = get_smart_diagnostics()
    net = get_host_network_info()
    remote_enabled = get_config_value("remote_mode_enabled", "false").lower() == "true"
    external_disks = get_connected_external_disks(force_refresh=True)
    active_disk = get_active_external_disk()
    tunnel_info = get_cloudflared_status()
    transfer_stats = get_active_transfer_stats()

    # Query active distinct valid sessions in SQLite
    active_sessions = 1
    try:
        with get_db() as conn:
            row = conn.execute("SELECT COUNT(DISTINCT user_id) as c FROM sessions WHERE expires_at > datetime('now');").fetchone()
            if row and row["c"]:
                active_sessions = max(1, row["c"])
    except Exception:
        pass
    
    for d in external_disks:
        d["is_active"] = bool(active_disk and d["drive_letter"].lower() == active_disk["drive_letter"].lower())

    return SystemStatusResponse(
        storage=storage,
        smart=smart,
        remote_mode_enabled=remote_enabled,
        server_time=datetime.now(timezone.utc).isoformat(),
        host_ip=net.get("lan_ip", "127.0.0.1"),
        lan_ip=net.get("lan_ip", "127.0.0.1"),
        has_external_disk=len(external_disks) > 0,
        active_external_disk=active_disk,
        external_disks=external_disks,
        tunnel=tunnel_info,
        active_transfers=transfer_stats["active_transfers"],
        active_sessions_count=active_sessions
    )

# ----------------- CLOUDFLARE TUNNEL ENDPOINTS -----------------

@app.get("/api/tunnel/status", response_model=TunnelStatusResponse)
def get_tunnel_status_endpoint(current_user: dict = Depends(get_current_user)):
    return get_cloudflared_status()

@app.post("/api/tunnel/start", response_model=TunnelStatusResponse)
def start_tunnel_endpoint(
    req: StartTunnelRequest,
    request: Request,
    admin_user: dict = Depends(require_admin)
):
    status_info = start_cloudflared_tunnel(req.token)
    log_audit_event(
        action="TUNNEL_START",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Cloudflare Tunnel started. Status: {status_info['status']}, Public URL: {status_info.get('public_url')}"
    )
    return status_info

@app.post("/api/tunnel/stop", response_model=TunnelStatusResponse)
def stop_tunnel_endpoint(
    request: Request,
    admin_user: dict = Depends(require_admin)
):
    status_info = stop_cloudflared_tunnel()
    log_audit_event(
        action="TUNNEL_STOP",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details="Cloudflare Tunnel stopped. Public remote access terminated."
    )
    return status_info

@app.get("/api/system/external-disks")
def list_external_disks(current_user: dict = Depends(get_current_user)):
    disks = get_connected_external_disks(force_refresh=True)
    active = get_active_external_disk()
    for d in disks:
        d["is_active"] = bool(active and d["drive_letter"].lower() == active["drive_letter"].lower())
    return {
        "external_disks": disks,
        "active_external_disk": active,
        "has_external_disk": len(disks) > 0
    }

@app.post("/api/system/external-disks/refresh")
def refresh_external_disks_endpoint(current_user: dict = Depends(get_current_user)):
    """Forces an immediate hardware rescan of all external drives on the host."""
    disks = refresh_external_disks()
    active = get_active_external_disk()
    for d in disks:
        d["is_active"] = bool(active and d["drive_letter"].lower() == active["drive_letter"].lower())
    return {
        "external_disks": disks,
        "active_external_disk": active,
        "has_external_disk": len(disks) > 0
    }

@app.post("/api/system/external-disks/select")
def select_external_disk(req: SelectDiskRequest, request: Request, admin_user: dict = Depends(require_admin)):
    selected = set_active_external_disk(req.drive_letter)
    log_audit_event(
        action="EXTERNAL_DISK_MOUNTED",
        username=admin_user["username"],
        user_id=admin_user["id"],
        ip_address=get_client_ip(request),
        is_remote=is_remote_client(request),
        details=f"Switched active storage root to external disk '{selected['drive_letter']}' ({selected.get('label', '')})"
    )
    return {"active_external_disk": selected, "message": f"External disk {selected['drive_letter']} mounted."}

@app.get("/api/system/network")
def get_network_details(current_user: dict = Depends(get_current_user)):
    net = get_host_network_info()
    remote_enabled = get_config_value("remote_mode_enabled", "false").lower() == "true"
    return {
        "lan_ip": net.get("lan_ip"),
        "hostname": net.get("hostname"),
        "remote_mode_enabled": remote_enabled,
        "default_port": 8000
    }

# Mount frontend static distribution if built
DIST_PATH = (Path(__file__).resolve().parent.parent.parent / "frontend" / "dist").resolve()
if DIST_PATH.exists():
    app.mount("/", StaticFiles(directory=str(DIST_PATH), html=True), name="static")
