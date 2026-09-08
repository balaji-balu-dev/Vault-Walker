import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List
import psutil
from .disk_manager import get_active_storage_root, get_active_external_disk

def get_storage_metrics(path: Optional[Path] = None, disk_identifier: Optional[str] = None) -> Dict[str, Any]:
    """Calculates total, used, free space and percentage using psutil on external disk."""
    from .disk_manager import get_connected_external_disks
    
    target_disk = None
    if disk_identifier:
        connected = get_connected_external_disks()
        clean_id = disk_identifier.strip().rstrip("\\").lower()
        target_disk = next(
            (d for d in connected if d["drive_letter"].rstrip("\\").lower() == clean_id or d["mount_point"].rstrip("\\").lower() == clean_id),
            None
        )
    
    if not target_disk:
        target_disk = get_active_external_disk()

    if not target_disk and not path:
        return {
            "total_bytes": 0,
            "used_bytes": 0,
            "free_bytes": 0,
            "percent_used": 0.0,
            "mount_point": "No External Disk",
            "has_disk": False
        }

    target_path = path or Path(target_disk["mount_point"])
    try:
        usage = psutil.disk_usage(str(target_path))
        return {
            "total_bytes": usage.total,
            "used_bytes": usage.used,
            "free_bytes": usage.free,
            "percent_used": usage.percent,
            "mount_point": str(target_path),
            "label": target_disk.get("label", "External Volume") if target_disk else "External Volume",
            "has_disk": True
        }
    except Exception as e:
        return {
            "total_bytes": 0,
            "used_bytes": 0,
            "free_bytes": 0,
            "percent_used": 0.0,
            "mount_point": str(target_path),
            "has_disk": False,
            "error": str(e)
        }

def find_smartctl_binary() -> Optional[str]:
    """Finds the smartctl binary on Windows or Linux."""
    # Check standard PATH
    path = shutil.which("smartctl")
    if path:
        return path
    
    # Common Windows install locations for smartmontools
    win_candidates = [
        r"C:\Program Files\smartmontools\bin\smartctl.exe",
        r"C:\Program Files (x86)\smartmontools\bin\smartctl.exe",
    ]
    for candidate in win_candidates:
        if os.path.exists(candidate):
            return candidate
            
    # Common Linux locations
    linux_candidates = ["/usr/sbin/smartctl", "/usr/bin/smartctl", "/usr/local/sbin/smartctl"]
    for candidate in linux_candidates:
        if os.path.exists(candidate):
            return candidate

    return None

def get_disk_io_stats() -> Dict[str, Any]:
    """Collects system-level disk I/O metrics via psutil."""
    try:
        counters = psutil.disk_io_counters()
        if counters:
            return {
                "read_count": counters.read_count,
                "write_count": counters.write_count,
                "read_bytes": counters.read_bytes,
                "write_bytes": counters.write_bytes,
                "read_time_ms": getattr(counters, "read_time", 0),
                "write_time_ms": getattr(counters, "write_time", 0),
            }
    except Exception:
        pass
    return {}

def get_smart_diagnostics(device_hint: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes smartctl subprocess to retrieve SMART attributes and health.
    Gracefully falls back to system psutil telemetry if smartctl is absent.
    """
    smartctl_bin = find_smartctl_binary()
    io_stats = get_disk_io_stats()

    if not smartctl_bin:
        return {
            "is_fallback": True,
            "status": "FALLBACK",
            "message": "smartctl is not detected on host system. Graceful fallback active (displaying disk usage & I/O telemetry).",
            "temperature_c": None,
            "power_on_hours": None,
            "reallocated_sectors": 0,
            "device_model": "Host Storage Volume",
            "serial_number": "N/A",
            "attributes": [
                {
                    "name": "Host Volume Status",
                    "value": "ONLINE",
                    "status": "OK"
                },
                {
                    "name": "Read Operations",
                    "value": io_stats.get("read_count", 0),
                    "status": "OK"
                },
                {
                    "name": "Write Operations",
                    "value": io_stats.get("write_count", 0),
                    "status": "OK"
                }
            ],
            "io_counters": io_stats
        }

    # Attempt to query drive via smartctl JSON mode
    target_dev = device_hint or "/dev/sda" if os.name != "nt" else "/dev/pd0"
    try:
        cmd = [smartctl_bin, "-a", "-j", target_dev]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=10
        )
        data = json.loads(result.stdout)
        
        # Determine overall health status
        smart_status = data.get("smart_status", {})
        passed = smart_status.get("passed", True)
        
        overall_status = "PASSED" if passed else "FAILED"
        
        # Temperature
        temperature = data.get("temperature", {}).get("current")
        
        # Power on time
        power_on = data.get("power_on_time", {}).get("hours")
        
        # Device info
        model = data.get("model_name") or data.get("device", {}).get("name", "Physical Drive")
        serial = data.get("serial_number", "N/A")
        
        # ATA SMART attributes table
        attributes: List[Dict[str, Any]] = []
        reallocated = 0
        
        ata_table = data.get("ata_smart_attributes", {}).get("table", [])
        for attr in ata_table:
            attr_id = attr.get("id")
            name = attr.get("name", f"Attribute {attr_id}")
            val = attr.get("value")
            worst = attr.get("worst")
            thresh = attr.get("thresh")
            raw_str = attr.get("raw", {}).get("string", str(attr.get("raw", {}).get("value", "")))
            attr_failed = attr.get("when_failed") != ""

            if "Reallocated_Sector_Ct" in name:
                try:
                    reallocated = int(attr.get("raw", {}).get("value", 0))
                except (ValueError, TypeError):
                    reallocated = 0

            attributes.append({
                "id": attr_id,
                "name": name,
                "value": val,
                "worst": worst,
                "threshold": thresh,
                "raw": raw_str,
                "status": "PRE-FAIL" if attr_failed else "OK"
            })
            
            if attr_failed and overall_status == "PASSED":
                overall_status = "WARNING"

        return {
            "is_fallback": False,
            "status": overall_status,
            "temperature_c": temperature,
            "power_on_hours": power_on,
            "reallocated_sectors": reallocated,
            "device_model": model,
            "serial_number": serial,
            "message": "Real-time SMART hardware telemetry active.",
            "attributes": attributes,
            "io_counters": io_stats
        }
    except Exception as e:
        return {
            "is_fallback": True,
            "status": "FALLBACK",
            "message": f"SMART query error ({str(e)}). Displaying fallback telemetry.",
            "temperature_c": None,
            "power_on_hours": None,
            "reallocated_sectors": 0,
            "device_model": "Host Storage Disk",
            "serial_number": "N/A",
            "attributes": [],
            "io_counters": io_stats
        }
