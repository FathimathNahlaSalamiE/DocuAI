"""Tiny in-memory sliding-window rate limiter. Counts reset when the server restarts and are
per-process, which is fine for a single-instance portfolio deployment."""
import threading
import time
from collections import defaultdict, deque

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def allow(key: str, limit: int, window_seconds: int) -> bool:
    """Record one hit for `key`. Returns False (and records nothing) if it is over the limit."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        # keep memory bounded: drop keys that have gone quiet
        if len(_hits) > 5000:
            for k in [k for k, v in _hits.items() if not v or now - v[-1] > window_seconds]:
                _hits.pop(k, None)
        return True