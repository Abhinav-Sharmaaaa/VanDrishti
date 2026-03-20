import json
import psycopg2
import psycopg2.pool
import psycopg2.extras
from config import cfg

_pool = psycopg2.pool.ThreadedConnectionPool(1, 5, dsn=cfg.DATABASE_URL)


def _query(sql, params=(), fetch="none"):
    conn = _pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            conn.commit()
            if fetch == "one": return cur.fetchone()
            if fetch == "all": return cur.fetchall()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


# ── API Cache ────────────────────────────────────────────────────────
class Cache:
    def set(self, key, value):
        _query("""
            INSERT INTO api_cache (key, value, fetched_at)
            VALUES (%s, %s, now())
            ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value,
                    fetched_at = EXCLUDED.fetched_at
        """, (key, json.dumps(value)))

    def get(self, key):
        row = _query(
            "SELECT value, fetched_at FROM api_cache WHERE key = %s",
            (key,), fetch="one"
        )
        if not row:
            return None
        return {"data": row["value"], "fetched_at": row["fetched_at"]}

    def age_minutes(self, key):
        row = _query("""
            SELECT EXTRACT(EPOCH FROM (now() - fetched_at)) / 60 AS age
            FROM api_cache WHERE key = %s
        """, (key,), fetch="one")
        return float(row["age"]) if row else float("inf")


# ── Zone Snapshots ───────────────────────────────────────────────────
class Snapshots:
    def insert(self, snap: dict):
        _query("""
            INSERT INTO zone_snapshots
                (zone_id, device_id, fhi, status, signals,
                 weather, fire, species, tree_cover, data_source)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            snap["id"],
            cfg.DEVICE_ID,
            snap["fhi"],
            snap["status"],
            json.dumps(snap["signals"]),
            json.dumps(snap["weather"]),
            json.dumps(snap["fire"]),
            json.dumps(snap["species"]),
            json.dumps(snap["treeCover"]),
            json.dumps(snap["dataSource"]),
        ))

    def latest(self, zone_id):
        row = _query("""
            SELECT * FROM zone_snapshots
            WHERE zone_id = %s
            ORDER BY created_at DESC LIMIT 1
        """, (zone_id,), fetch="one")
        return dict(row) if row else None

    def history(self, zone_id, limit=48):
        rows = _query("""
            SELECT * FROM zone_snapshots
            WHERE zone_id = %s
            ORDER BY created_at DESC LIMIT %s
        """, (zone_id, limit), fetch="all")
        return [dict(r) for r in rows]


# ── Sync Queue ───────────────────────────────────────────────────────
class SyncQueue:
    def push(self, payload: dict):
        _query(
            "INSERT INTO sync_queue (payload) VALUES (%s)",
            (json.dumps(payload),)
        )

    def peek(self, limit=20):
        rows = _query(
            "SELECT * FROM sync_queue ORDER BY id ASC LIMIT %s",
            (limit,), fetch="all"
        )
        return [dict(r) for r in rows]

    def delete(self, ids: list):
        if not ids:
            return
        _query(
            "DELETE FROM sync_queue WHERE id = ANY(%s)",
            (ids,)
        )

    def increment_attempts(self, row_id: int):
        _query(
            "UPDATE sync_queue SET attempts = attempts + 1 WHERE id = %s",
            (row_id,)
        )

    def size(self):
        row = _query("SELECT COUNT(*) AS n FROM sync_queue", fetch="one")
        return int(row["n"]) if row else 0


# Singletons
cache      = Cache()
snapshots  = Snapshots()
sync_queue = SyncQueue()