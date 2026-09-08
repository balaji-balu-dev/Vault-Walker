import ctypes
import os
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
import psutil
from fastapi import HTTPException, status
from .database import get_config_value, set_config_value

from ctypes import wintypes
import struct
import subprocess
import json

# Short cache (1.0 second) to allow instant detection of newly inserted drives
_cache_time = 0
_cached_disks: List[Dict[str, Any]] = []

IOCTL_STORAGE_QUERY_PROPERTY = 0x002D1400

class STORAGE_PROPERTY_QUERY(ctypes.Structure):
    _fields_ = [
        ('PropertyId', wintypes.DWORD),
        ('QueryType', wintypes.DWORD),
        ('AdditionalParameters', wintypes.BYTE * 1)
    ]

def get_volume_details_win32(root: str) -> tuple:
    """Uses Win32 GetVolumeInformationW for instant volume label and filesystem query."""
    try:
        kernel32 = ctypes.windll.kernel32
        vol_name = ctypes.create_unicode_buffer(261)
        fs_name = ctypes.create_unicode_buffer(261)
        res = kernel32.GetVolumeInformationW(
            root,
            vol_name,
            ctypes.sizeof(vol_name),
            None, None, None,
            fs_name,
            ctypes.sizeof(fs_name)
        )
        if res != 0:
            return vol_name.value, fs_name.value
    except Exception:
        pass
    return "", "FAT32"

def is_external_drive_win32(letter: str, system_drive: str) -> tuple[bool, str, str]:
    """
    Determines if a Windows drive letter belongs to an external storage drive.
    External hard drives / SSDs via USB typically report as DRIVE_FIXED (dtype 3) with BusType 7 (USB).
    Flash thumb drives report as DRIVE_REMOVABLE (dtype 2).
    Both are valid external storage drives.
    """
    clean_letter = letter.upper().rstrip(":")
    if clean_letter == system_drive.rstrip(":"):
        return False, "Internal System", ""

    kernel32 = ctypes.windll.kernel32
    root = f"{clean_letter}:\\"
    dtype = kernel32.GetDriveTypeW(root)

    # 2 = DRIVE_REMOVABLE (USB flash thumb drives, SD cards)
    if dtype == 2:
        return True, "USB / Removable", f"USB Removable Drive ({clean_letter}:)"

    # 3 = DRIVE_FIXED (External USB HDDs, USB SSDs, SATA/NVMe enclosures)
    if dtype == 3:
        h = kernel32.CreateFileW(
            f"\\\\.\\{clean_letter}:",
            0, # Query permissions (does not require Administrator elevation)
            1 | 2, # FILE_SHARE_READ | FILE_SHARE_WRITE
            None,
            3, # OPEN_EXISTING
            0,
            None
        )
        if h != -1 and h != 0xFFFFFFFF:
            try:
                query = STORAGE_PROPERTY_QUERY()
                query.PropertyId = 0 # StorageDeviceProperty
                query.QueryType = 0  # PropertyStandardQuery
                buf = (ctypes.c_byte * 1024)()
                bytes_ret = wintypes.DWORD()
                if kernel32.DeviceIoControl(
                    h,
                    IOCTL_STORAGE_QUERY_PROPERTY,
                    ctypes.byref(query),
                    ctypes.sizeof(query),
                    ctypes.byref(buf),
                    ctypes.sizeof(buf),
                    ctypes.byref(bytes_ret),
                    None
                ):
                    data = bytes(buf)
                    # BusType is at offset 28 in STORAGE_DEVICE_DESCRIPTOR
                    bus_type = struct.unpack('<I', data[28:32])[0]

                    # Extract vendor & product name strings if available
                    vendor_offset = struct.unpack('<I', data[16:20])[0]
                    product_offset = struct.unpack('<I', data[20:24])[0]
                    vendor_name = ''
                    product_name = ''
                    if 0 < vendor_offset < len(data):
                        vendor_name = data[vendor_offset:].split(b'\x00')[0].decode('ascii', errors='ignore').strip()
                    if 0 < product_offset < len(data):
                        product_name = data[product_offset:].split(b'\x00')[0].decode('ascii', errors='ignore').strip()

                    model_name = f"{vendor_name} {product_name}".strip()

                    # 7 = BusTypeUsb, 12 = BusTypeSd, 13 = BusTypeMmc
                    if bus_type == 7:
                        return True, "USB External HDD/SSD", model_name or f"External USB Disk ({clean_letter}:)"
                    if bus_type in (12, 13):
                        return True, "SD / MMC Storage", model_name or f"External SD Card ({clean_letter}:)"
            finally:
                kernel32.CloseHandle(h)

    return False, "", ""

def get_connected_external_disks(force_refresh: bool = False) -> List[Dict[str, Any]]:
    """
    Detects physically connected external drives (USB flash drives, external HDDs, SSD enclosures).
    Strictly excludes internal system fixed drives (C:) and virtual network drives.
    Instant execution using ctypes and psutil.
    """
    global _cache_time, _cached_disks
    now = time.time()
    if not force_refresh and (now - _cache_time) < 1.0:
        return _cached_disks

    disks: List[Dict[str, Any]] = []

    if os.name == "nt":
        system_drive = os.environ.get("SystemDrive", "C:").upper()

        for letter in "DEFGHIJKLMNOPQRSTUVWXYZ":
            drive_str = f"{letter}:"
            root = f"{drive_str}\\"

            is_ext, bus_type, friendly_name = is_external_drive_win32(letter, system_drive)
            if is_ext:
                try:
                    usage = psutil.disk_usage(root)
                    label, fs = get_volume_details_win32(root)
                    disks.append({
                        "mount_point": root,
                        "drive_letter": drive_str,
                        "bus_type": bus_type,
                        "friendly_name": friendly_name or f"External Drive ({drive_str})",
                        "label": label or friendly_name or f"External Storage ({drive_str})",
                        "filesystem": fs,
                        "size_bytes": usage.total,
                        "free_bytes": usage.free,
                        "used_bytes": usage.used,
                        "percent_used": usage.percent
                    })
                except Exception:
                    # Drive letter exists without readable media or currently unmounted
                    pass

    else:
        # Linux / Unix external drives (mounts in /media, /mnt, /run/media)
        partitions = psutil.disk_partitions(all=False)
        for p in partitions:
            mp = p.mountpoint
            if mp == "/" or mp.startswith("/boot") or mp.startswith("/snap"):
                continue
            if mp.startswith("/media") or mp.startswith("/mnt") or mp.startswith("/run/media"):
                try:
                    usage = psutil.disk_usage(mp)
                    disks.append({
                        "mount_point": mp,
                        "drive_letter": mp,
                        "bus_type": "USB / External",
                        "friendly_name": Path(mp).name or "External Disk",
                        "label": Path(mp).name or "External Storage",
                        "filesystem": p.fstype,
                        "size_bytes": usage.total,
                        "free_bytes": usage.free,
                        "used_bytes": usage.used,
                        "percent_used": usage.percent
                    })
                except Exception:
                    pass

    _cached_disks = disks
    _cache_time = now
    return disks

def get_active_external_disk() -> Optional[Dict[str, Any]]:
    """
    Returns the currently active external disk.
    If multiple are attached, returns the user-selected or first available.
    """
    connected = get_connected_external_disks()
    if not connected:
        return None

    configured_letter = get_config_value("active_external_disk", "")
    if configured_letter:
        matched = next((d for d in connected if d["drive_letter"].lower() == configured_letter.lower()), None)
        if matched:
            return matched

    # Default to first detected external disk
    chosen = connected[0]
    set_config_value("active_external_disk", chosen["drive_letter"])
    return chosen

def set_active_external_disk(drive_identifier: str) -> Dict[str, Any]:
    """Allows selecting which external disk to mount/browse."""
    connected = get_connected_external_disks(force_refresh=True)
    clean_id = drive_identifier.strip().rstrip("\\")
    matched = next((d for d in connected if d["drive_letter"].rstrip("\\").lower() == clean_id.lower()), None)
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"External disk '{drive_identifier}' is not currently connected."
        )

    set_config_value("active_external_disk", matched["drive_letter"])
    return matched

def get_storage_root_for_disk(drive_identifier: Optional[str] = None) -> Path:
    """
    Returns the resolved Path for the requested external disk, or active disk if None.
    Strictly validates that the drive is an active, allowed external storage volume (never system drive).
    """
    if drive_identifier:
        connected = get_connected_external_disks()
        clean_id = drive_identifier.strip().rstrip("\\").lower()
        matched = next(
            (d for d in connected if d["drive_letter"].rstrip("\\").lower() == clean_id or d["mount_point"].rstrip("\\").lower() == clean_id),
            None
        )
        if not matched:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"External disk '{drive_identifier}' is not currently connected."
            )
        return Path(matched["mount_point"]).resolve()

    return get_active_storage_root()

def get_active_storage_root() -> Path:
    """
    Returns the Path to the active external disk storage root.
    Raises 400 Bad Request if no external disk is attached.
    """
    active = get_active_external_disk()
    if not active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No external storage disk detected. Please connect an external USB hard disk or flash drive to the host machine."
        )
    return Path(active["mount_point"]).resolve()

def refresh_external_disks() -> List[Dict[str, Any]]:
    """Forces an immediate hardware rescan of all connected storage disks."""
    return get_connected_external_disks(force_refresh=True)

