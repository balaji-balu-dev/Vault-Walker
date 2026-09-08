import ipaddress
import socket
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .auth import get_session_user
from .database import get_config_value

security_bearer = HTTPBearer(auto_error=False)

def get_client_ip(request: Optional[Request]) -> str:
    """Extracts client IP address considering proxy headers if available."""
    if not request:
        return "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # First IP in comma-separated list
        ip = forwarded.split(",")[0].strip()
        return ip
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

def is_private_ip(ip_str: str) -> bool:
    """Checks if an IP belongs to private LAN, loopback, or non-global ranges."""
    try:
        # Clean IPv6-mapped IPv4 e.g. ::ffff:192.168.1.1
        if ip_str.startswith("::ffff:"):
            ip_str = ip_str.replace("::ffff:", "")
        ip = ipaddress.ip_address(ip_str)
        # Any IP that is not globally routable is local/LAN/private
        return not ip.is_global or ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        # Fallback: if string is localhost
        return ip_str in ("127.0.0.1", "localhost", "::1")

def is_remote_client(request: Optional[Request]) -> bool:
    if not request:
        return False
    client_ip = get_client_ip(request)
    return not is_private_ip(client_ip)

def get_host_network_info() -> Dict[str, str]:
    """Resolves the host machine's local LAN IP address."""
    lan_ip = "127.0.0.1"
    try:
        # Connect to an external address without sending packets to detect default interface IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            lan_ip = s.getsockname()[0]
    except Exception:
        lan_ip = "127.0.0.1"
    
    return {
        "lan_ip": lan_ip,
        "hostname": socket.gethostname()
    }

async def verify_network_access(request: Request) -> None:
    """Middleware/dependency checking whether remote internet access is permitted."""
    is_remote = is_remote_client(request)
    remote_mode_enabled = get_config_value("remote_mode_enabled", "false").lower() == "true"
    
    if is_remote and not remote_mode_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Emergency Remote Access is currently disabled by the administrator. Access permitted via local LAN only."
        )

async def get_current_user(
    request: Request,
    auth_header: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> dict:
    """Validates session token from Bearer header, session cookie, or query param token."""
    # First check network restriction
    await verify_network_access(request)

    token = None
    if auth_header and auth_header.credentials:
        token = auth_header.credentials
    elif request.cookies.get("session_token"):
        token = request.cookies.get("session_token")
    elif request.query_params.get("token"):
        token = request.query_params.get("token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid session key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_session_user(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or credentials are invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Enforces admin role strictly on endpoint."""
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required for this operation."
        )
    return user

async def require_write_permission(user: dict = Depends(get_current_user)) -> dict:
    """
    Enforces file mutating permissions:
    - Regular users can browse and upload only.
    - Delete, rename, and folder management require admin.
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Regular users have read and upload permissions only. Delete or modify operations require administrator."
        )
    return user
