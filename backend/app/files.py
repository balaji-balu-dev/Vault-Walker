import mimetypes
import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from .disk_manager import get_storage_root_for_disk, get_active_storage_root

# System / hidden directories to skip during scanning
IGNORE_DIRS = {
    ".spotlight-v100", ".trashes", "$recycle.bin", "system volume information",
    "recovery", "config.msi", ".fseventsd", "found.000", ".git", "node_modules"
}

# Categories definition
CATEGORY_EXTENSIONS = {
    "image": {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".tiff", ".avif"},
    "document": {".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt", ".xls", ".xlsx", ".ods", ".csv", ".ppt", ".pptx", ".odp", ".epub", ".json", ".xml", ".yaml", ".yml"},
    "video": {".mp4", ".mkv", ".webm", ".avi", ".mov", ".wmv", ".flv", ".m4v", ".3gp", ".ts"}
}

def get_file_category(file_path: Path) -> str:
    """Classifies a file into 'image', 'document', 'video', or 'other'."""
    ext = file_path.suffix.lower()
    for cat, exts in CATEGORY_EXTENSIONS.items():
        if ext in exts:
            return cat
    return "other"

def safe_resolve_path(rel_path: str = "", disk_identifier: Optional[str] = None) -> Path:
    """
    Safely resolves a relative path against the specified external storage disk root (or active disk).
    Strictly protects against path traversal ('..', symlinks pointing outside the external disk root).
    """
    root = get_storage_root_for_disk(disk_identifier)
    clean_rel = rel_path.strip().lstrip("/\\")
    
    # Strictly forbid any parent directory traversal segments
    rel_obj = Path(clean_rel)
    if ".." in rel_obj.parts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: Path traversal ('..') outside external disk is forbidden."
        )

    target = (root / clean_rel).resolve()
    
    # Check that target is strictly within or equal to active external disk root
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access denied: Path traversal outside external disk is forbidden."
        )
    return target

def get_breadcrumbs(rel_path: str) -> List[Dict[str, str]]:
    """Builds a breadcrumb chain from relative path."""
    crumbs = [{"name": "Root", "path": ""}]
    if not rel_path.strip():
        return crumbs
    
    parts = Path(rel_path.strip().replace("\\", "/")).parts
    accum = []
    for part in parts:
        if part and part != ".":
            accum.append(part)
            crumbs.append({
                "name": part,
                "path": "/".join(accum)
            })
    return crumbs

def inspect_file_item(item_path: Path, root_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Generates standardized file metadata dictionary. Gracefully handles unreadable/corrupted files."""
    if root_path is None:
        root_path = get_active_storage_root()

    try:
        stat = item_path.stat()
        is_dir = item_path.is_dir()
    except (OSError, PermissionError, FileNotFoundError):
        return None

    try:
        rel = item_path.relative_to(root_path).as_posix()
    except ValueError:
        rel = item_path.name

    category = "folder" if is_dir else get_file_category(item_path)
    mime, _ = mimetypes.guess_type(str(item_path))

    return {
        "name": item_path.name,
        "path": rel,
        "is_dir": is_dir,
        "size": 0 if is_dir else stat.st_size,
        "modified_at": stat.st_mtime,
        "category": category,
        "extension": item_path.suffix.lower().lstrip("."),
        "mime_type": mime or ("inode/directory" if is_dir else "application/octet-stream"),
        "has_thumbnail": category == "image"
    }

def list_files(
    rel_path: str = "",
    category_filter: Optional[str] = None,
    search_query: Optional[str] = None,
    sort_by: str = "name",
    sort_order: str = "asc",
    limit: int = 60,
    offset: int = 0,
    disk_identifier: Optional[str] = None
) -> Dict[str, Any]:
    """
    Lists files inside directory with high-performance scanning and pagination.
    Avoids unconstrained recursive disk walks by enforcing depth caps and ignoring system folders.
    """
    root = get_storage_root_for_disk(disk_identifier)
    target_dir = safe_resolve_path(rel_path, disk_identifier)

    if not target_dir.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Directory not found."
        )
    if not target_dir.is_dir():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Target path is not a directory."
        )

    all_items: List[Dict[str, Any]] = []

    # If category filter is specified (e.g. "image", "document", "video"),
    # we scan with safe depth limit to prevent infinite I/O latency on slow USB disks.
    if category_filter and category_filter in ("image", "document", "video"):
        max_scan_items = 1500
        target_str = str(target_dir)
        target_parts_len = len(Path(target_str).parts)

        for dirpath, dirnames, filenames in os.walk(target_str):
            # Prune hidden / system directories in place
            dirnames[:] = [
                d for d in dirnames
                if not d.startswith(".") and d.lower() not in IGNORE_DIRS
            ]

            # Enforce max depth of 4 levels to keep response times sub-second
            current_depth = len(Path(dirpath).parts) - target_parts_len
            if current_depth > 4:
                del dirnames[:]
                continue

            for f in filenames:
                if f.startswith("."):
                    continue
                if search_query and search_query.lower() not in f.lower():
                    continue

                f_path = Path(dirpath) / f
                if get_file_category(f_path) == category_filter:
                    try:
                        item = inspect_file_item(f_path, root)
                        if item:
                            all_items.append(item)
                    except Exception:
                        pass

                    if len(all_items) >= max_scan_items:
                        break

            if len(all_items) >= max_scan_items:
                break
    else:
        # Standard folder listing (immediate children only)
        try:
            with os.scandir(str(target_dir)) as it:
                for entry in it:
                    try:
                        name = entry.name
                        # Skip hidden system volume files
                        if name.lower() in IGNORE_DIRS or (name.startswith(".") and name != "."):
                            continue
                        if search_query and search_query.lower() not in name.lower():
                            continue

                        entry_path = Path(entry.path)
                        item = inspect_file_item(entry_path, root)
                        if item:
                            all_items.append(item)
                    except (PermissionError, FileNotFoundError, OSError):
                        pass
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permission denied accessing disk directory."
            )
        except OSError:
            pass

    # Sort items: Directories first (unless filtering by media category), then sort key
    reverse = (sort_order.lower() == "desc")
    
    def sort_key(x):
        is_dir_priority = 0 if x["is_dir"] else 1
        if sort_by == "size":
            val = x["size"]
        elif sort_by in ("date", "modified"):
            val = x["modified_at"]
        else:  # name
            val = x["name"].lower()
        return (is_dir_priority, val)

    all_items.sort(key=sort_key, reverse=reverse)

    total_count = len(all_items)
    total_files = sum(1 for x in all_items if not x["is_dir"])
    total_dirs = sum(1 for x in all_items if x["is_dir"])

    # Slice for pagination
    sliced_items = all_items[offset : offset + limit]
    has_more = (offset + limit) < total_count

    clean_rel = rel_path.strip().replace("\\", "/").strip("/")
    return {
        "current_path": clean_rel,
        "breadcrumbs": get_breadcrumbs(clean_rel),
        "items": sliced_items,
        "total_files": total_files,
        "total_dirs": total_dirs,
        "total_count": total_count,
        "limit": limit,
        "offset": offset,
        "has_more": has_more,
        "disk": disk_identifier or root.drive or str(root)
    }

def create_directory(parent_rel: str, folder_name: str, disk_identifier: Optional[str] = None) -> Path:
    """Creates a new subdirectory."""
    sanitized_name = folder_name.strip().replace("/", "_").replace("\\", "_")
    if not sanitized_name or sanitized_name in (".", ".."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid folder name.")
    
    parent = safe_resolve_path(parent_rel, disk_identifier)
    new_dir = parent / sanitized_name
    
    if new_dir.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Directory already exists.")
    
    new_dir.mkdir(parents=True, exist_ok=False)
    return new_dir

def rename_item(old_rel: str, new_name: str, disk_identifier: Optional[str] = None) -> Path:
    """Renames a file or directory."""
    sanitized_name = new_name.strip().replace("/", "_").replace("\\", "_")
    if not sanitized_name or sanitized_name in (".", ".."):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid new name.")
    
    source = safe_resolve_path(old_rel, disk_identifier)
    if not source.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target item not found.")
    
    target = source.parent / sanitized_name
    if target.exists():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An item with that name already exists.")
    
    source.rename(target)
    return target

def delete_items(rel_paths: List[str], disk_identifier: Optional[str] = None) -> List[str]:
    """Deletes multiple files or directories recursively."""
    root = get_storage_root_for_disk(disk_identifier)
    deleted = []
    for rel in rel_paths:
        target = safe_resolve_path(rel, disk_identifier)
        if target == root:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete external storage root.")
        if target.exists():
            if target.is_dir():
                shutil.rmtree(str(target))
            else:
                target.unlink()
            deleted.append(rel)
    return deleted
