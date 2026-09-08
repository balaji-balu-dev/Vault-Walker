from typing import Optional, List, Any
from pydantic import BaseModel, Field

# Authentication Models
class LoginRequest(BaseModel):
    key: str = Field(..., min_length=16, description="Cryptographic access key")

class LoginResponse(BaseModel):
    session_token: str
    username: str
    role: str
    expires_at: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: str
    is_active: bool

class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    role: str = Field("user", pattern="^(admin|user)$")

class CreateUserResponse(BaseModel):
    id: int
    username: str
    role: str
    raw_key: str  # Displayed only once!
    warning: str = "Save this key securely. It cannot be recovered and will not be shown again."

# File Explorer Models
class FileItem(BaseModel):
    name: str
    path: str  # relative to storage root
    is_dir: bool
    size: int
    modified_at: float
    category: str  # 'image' | 'document' | 'video' | 'other'
    extension: str
    mime_type: str
    has_thumbnail: bool = False

class FileListResponse(BaseModel):
    current_path: str
    breadcrumbs: List[dict]
    items: List[FileItem]
    total_files: int
    total_dirs: int
    total_count: int = 0
    limit: int = 60
    offset: int = 0
    has_more: bool = False
    disk: Optional[str] = None

class CreateFolderRequest(BaseModel):
    current_path: str = ""
    folder_name: str = Field(..., min_length=1, max_length=255)
    disk: Optional[str] = None

class RenameRequest(BaseModel):
    old_path: str
    new_name: str
    disk: Optional[str] = None

class DeleteRequest(BaseModel):
    paths: List[str]
    disk: Optional[str] = None

class ZipDownloadRequest(BaseModel):
    paths: List[str]
    disk: Optional[str] = None

# System & Disk Health Models
class StorageUsage(BaseModel):
    total_bytes: int
    used_bytes: int
    free_bytes: int
    percent_used: float
    mount_point: str
    label: Optional[str] = "External Volume"
    has_disk: bool = True

class ExternalDiskItem(BaseModel):
    mount_point: str
    drive_letter: str
    bus_type: str
    friendly_name: str
    label: str
    filesystem: str
    size_bytes: int
    free_bytes: int
    used_bytes: int
    percent_used: float
    is_active: bool = False

class SelectDiskRequest(BaseModel):
    drive_letter: str

class SmartAttribute(BaseModel):
    id: Optional[int] = None
    name: str
    value: Any
    worst: Any = None
    threshold: Any = None
    raw: Any = None
    status: str

class SmartHealthResponse(BaseModel):
    is_fallback: bool
    status: str  # 'PASSED' | 'FAILED' | 'WARNING' | 'FALLBACK'
    temperature_c: Optional[int] = None
    power_on_hours: Optional[int] = None
    reallocated_sectors: Optional[int] = None
    device_model: Optional[str] = None
    serial_number: Optional[str] = None
    message: Optional[str] = None
    attributes: List[SmartAttribute] = []
    io_counters: Optional[dict] = None

class TunnelStatusResponse(BaseModel):
    is_running: bool
    status: str  # "ONLINE" | "STARTING" | "OFFLINE" | "ERROR"
    public_url: Optional[str] = None
    uptime_seconds: int = 0
    binary_available: bool = True
    binary_path: Optional[str] = None
    error_message: Optional[str] = None
    recent_logs: List[str] = []

class StartTunnelRequest(BaseModel):
    token: Optional[str] = None

class SystemStatusResponse(BaseModel):
    storage: StorageUsage
    smart: SmartHealthResponse
    remote_mode_enabled: bool
    server_time: str
    host_ip: str
    lan_ip: str
    has_external_disk: bool = True
    active_external_disk: Optional[ExternalDiskItem] = None
    external_disks: List[ExternalDiskItem] = []
    tunnel: Optional[TunnelStatusResponse] = None
    active_transfers: int = 0
    active_sessions_count: int = 0

class RemoteModeToggleRequest(BaseModel):
    enabled: bool

# Audit Log Models
class AuditLogEntry(BaseModel):
    id: int
    username: Optional[str]
    action: str
    ip_address: Optional[str]
    is_remote: bool
    details: Optional[str]
    timestamp: str
