import requests
from config    import cfg
from db        import sync_queue

MAX_ATTEMPTS = 5


def enqueue(snapshot: dict):
    """Add snapshot to sync queue — called every cycle."""
    sync_queue.push(snapshot)


def flush():
    """
    Send all queued snapshots to the backend.
    Called when network comes back online and on each online cycle.
    """
    pending = sync_queue.peek(20)
    if not pending:
        return

    print(f"[sync] Flushing {len(pending)} item(s)")

    for row in pending:
        if row["attempts"] >= MAX_ATTEMPTS:
            print(f"[sync] Dropping item {row['id']} — too many attempts")
            sync_queue.delete([row["id"]])
            continue

        try:
            r = requests.post(
                f"{cfg.BACKEND_URL}/api/ingest",
                json=row["payload"],
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key":    cfg.BACKEND_KEY,
                },
                timeout=8
            )

            if r.ok:
                sync_queue.delete([row["id"]])
                print(f"[sync] Item {row['id']} → OK ({r.status_code})")
            else:
                sync_queue.increment_attempts(row["id"])
                print(f"[sync] Item {row['id']} → rejected ({r.status_code})")

        except Exception as e:
            sync_queue.increment_attempts(row["id"])
            print(f"[sync] Item {row['id']} → failed: {e}")
            break   # network down — stop, retry next cycle