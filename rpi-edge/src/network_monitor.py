import threading
import requests
from config import cfg

_online  = False
_lock    = threading.Lock()
_online_cbs  = []
_offline_cbs = []


def is_online() -> bool:
    with _lock:
        return _online


def on_online(fn):
    _online_cbs.append(fn)


def on_offline(fn):
    _offline_cbs.append(fn)


def _probe() -> bool:
    try:
        r = requests.get(
            f"{cfg.BACKEND_URL}/health",
            headers={"X-API-Key": cfg.BACKEND_KEY},
            timeout=5
        )
        return r.ok
    except Exception:
        return False


def check_once():
    global _online
    with _lock:
        was = _online

    now = _probe()

    with _lock:
        _online = now

    if not was and now:
        print("[network] Online — backend reachable")
        for fn in _online_cbs:
            fn()
    elif was and not now:
        print("[network] Offline — working locally")
        for fn in _offline_cbs:
            fn()