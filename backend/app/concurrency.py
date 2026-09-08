"""
Vault Walker Concurrency & Transfer Rate Control Engine

LATENCY NOTE & REMOTE BANDWIDTH REALITY:
----------------------------------------
When accessing Vault Walker remotely via Cloudflare Tunnel, the dominant latency
and throughput factor is NOT the tunnel or Cloudflare's edge proxy. The primary
constraint is the physical host machine's home-internet residential UPLOAD bandwidth
(e.g., standard residential ADSL/cable/fiber upload caps, which often range from
10 Mbps to 100 Mbps).

To maximize throughput and prevent resource exhaustion or bufferbloat:
1. File transfers (downloads, uploads, ZIP streaming) are strictly streamed in 64 KB
   chunks rather than buffering multi-megabyte or gigabyte files in host RAM.
2. Concurrent transfer caps are enforced per session and app-wide to prevent one remote
   user from starving all local LAN users or collapsing host uplink pipes.
"""

import threading
from typing import Dict, Any
from fastapi import HTTPException, status

# Default transfer concurrency limits
MAX_CONCURRENT_TRANSFERS_APP = 10
MAX_CONCURRENT_TRANSFERS_SESSION = 3

_lock = threading.Lock()
_active_app_transfers = 0
_active_session_transfers: Dict[str, int] = {}

class TransferSlot:
    """
    Context manager that acquires and releases a transfer concurrency slot.
    Guarantees thread-safe tracking of active upload and download streams.
    Raises HTTP 503 (Service Unavailable) if the concurrency cap is exceeded.
    """
    def __init__(self, session_id: str, transfer_type: str = "transfer"):
        self.session_id = session_id or "anonymous"
        self.transfer_type = transfer_type

    def __enter__(self):
        global _active_app_transfers, _active_session_transfers
        with _lock:
            if _active_app_transfers >= MAX_CONCURRENT_TRANSFERS_APP:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Server busy: Server-wide active transfer limit reached. Please try again shortly."
                )

            session_count = _active_session_transfers.get(self.session_id, 0)
            if session_count >= MAX_CONCURRENT_TRANSFERS_SESSION:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Server busy: You have reached the maximum simultaneous transfer limit (3 concurrent). Please wait for an active transfer to complete."
                )

            _active_app_transfers += 1
            _active_session_transfers[self.session_id] = session_count + 1

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        global _active_app_transfers, _active_session_transfers
        with _lock:
            _active_app_transfers = max(0, _active_app_transfers - 1)
            if self.session_id in _active_session_transfers:
                _active_session_transfers[self.session_id] = max(0, _active_session_transfers[self.session_id] - 1)
                if _active_session_transfers[self.session_id] == 0:
                    del _active_session_transfers[self.session_id]

def get_active_transfer_stats() -> Dict[str, Any]:
    """Returns real-time telemetry on active file transfers."""
    with _lock:
        return {
            "active_transfers": _active_app_transfers,
            "max_app_transfers": MAX_CONCURRENT_TRANSFERS_APP,
            "max_session_transfers": MAX_CONCURRENT_TRANSFERS_SESSION,
            "active_client_count": len(_active_session_transfers)
        }
