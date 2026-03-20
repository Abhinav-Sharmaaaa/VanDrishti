import threading
from flask           import Flask, jsonify, request
from config          import cfg
from db              import snapshots as db_snaps, sync_queue
from network_monitor import is_online

app     = Flask(__name__)
_latest = None   # in-memory latest snapshot


def set_latest(snap: dict):
    global _latest
    _latest = snap


STATUS_COLOR = {
    "healthy":  "#22A95C",
    "watch":    "#D97706",
    "alert":    "#EA580C",
    "critical": "#DC3545",
}


# ── HTML dashboard — works in any browser, even offline ──────────────
@app.route("/")
def dashboard():
    s     = _latest
    color = STATUS_COLOR.get(s["status"], "#888") if s else "#888"

    def signal_rows():
        if not s:
            return ""
        sig = s["signals"]
        rows = [
            ("NDVI",          sig["ndvi"]),
            ("Biodiversity",  sig["biodiversity"]),
            ("Thermal risk",  sig["thermalRisk"]),
            ("Moisture",      sig["moisture"]),
            ("Cover health",  sig["coverHealth"]),
        ]
        return "".join(
            f'<div class="row"><span>{k}</span>'
            f'<span style="font-family:monospace">{v}%</span></div>'
            for k, v in rows
        )

    def weather_rows():
        if not s:
            return ""
        w = s["weather"]
        rows = [
            ("Temp",     f"{w['temp']}°C"),
            ("Humidity", f"{w['humidity']}%"),
            ("Wind",     f"{w['windSpeed']} m/s"),
            ("Rain",     f"{w['rainfall']} mm/h"),
            ("Condition", w["condition"]),
        ]
        return "".join(
            f'<div class="row"><span>{k}</span><span>{v}</span></div>'
            for k, v in rows
        )

    def source_rows():
        if not s:
            return ""
        return "".join(
            f'<div class="row"><span>{k}</span>'
            f'<span style="color:{"#22A95C" if v != "mock" else "#D97706"}">{v}</span></div>'
            for k, v in s["dataSource"].items()
        )

    fire_count = s["fire"]["count"] if s else 0
    species    = s["species"]["count"] if s else 0

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VanDrishti — {cfg.ZONE_NAME}</title>
  <meta http-equiv="refresh" content="30">
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0 }}
    body {{ font-family: system-ui, sans-serif; background: #f9fafb;
            color: #111; padding: 20px }}
    .wrap {{ max-width: 480px; margin: 0 auto }}
    .card {{ background: #fff; border-radius: 12px; padding: 20px;
             margin-bottom: 14px; border: 1px solid #e5e7eb }}
    .fhi  {{ font-size: 64px; font-weight: 700; color: {color}; line-height: 1 }}
    .status {{ font-size: 18px; font-weight: 600; color: {color}; margin: 6px 0 }}
    .label {{ font-size: 11px; color: #6b7280; text-transform: uppercase;
              letter-spacing: .05em; margin-bottom: 10px }}
    .row  {{ display: flex; justify-content: space-between; padding: 6px 0;
             border-bottom: 1px solid #f3f4f6; font-size: 13px }}
    .row:last-child {{ border: none }}
    .pill {{ display: inline-block; padding: 2px 10px; border-radius: 20px;
             font-size: 11px; font-weight: 600 }}
    .online  {{ background: #dcfce7; color: #16834A }}
    .offline {{ background: #fee2e2; color: #991b1b }}
    .footer  {{ text-align: center; font-size: 12px; color: #9ca3af; margin-top: 10px }}
  </style>
</head>
<body>
<div class="wrap">

  <div class="card">
    <div class="label">{cfg.ZONE_NAME} · {cfg.DEVICE_ID}</div>
    {"".join([
        f'<div class="fhi">{s["fhi"]}</div>',
        f'<div class="status">{s["status"].upper()}</div>',
        f'<p style="font-size:13px;color:#6b7280;margin-top:8px">',
        f'Fire events: {fire_count} &nbsp;|&nbsp; Species: {species}',
        f'</p>',
        f'<p style="font-size:11px;color:#9ca3af;margin-top:4px">',
        f'{s["lastUpdated"][:19].replace("T", " ")} UTC</p>',
    ]) if s else '<p style="color:#6b7280">Waiting for first cycle…</p>'}
  </div>

  {"".join([
      '<div class="card">',
      '<div class="label">Signals</div>',
      signal_rows(),
      '</div>',
      '<div class="card">',
      '<div class="label">Weather</div>',
      weather_rows(),
      '</div>',
      '<div class="card">',
      '<div class="label">Data sources</div>',
      source_rows(),
      '</div>',
  ]) if s else ""}

  <div class="card" style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:13px;color:#6b7280">Backend</span>
    <span class="pill {'online' if is_online() else 'offline'}">
      {'ONLINE' if is_online() else 'OFFLINE — local cache'}
    </span>
  </div>

  <div class="footer">
    Auto-refresh 30s &nbsp;·&nbsp;
    <a href="/api/snapshot">JSON</a> &nbsp;·&nbsp;
    Queue: {sync_queue.size()} pending
  </div>
</div>
</body>
</html>"""


# ── JSON API ─────────────────────────────────────────────────────────
@app.route("/api/status")
def api_status():
    return jsonify({
        "deviceId":  cfg.DEVICE_ID,
        "zoneId":    cfg.ZONE_ID,
        "zoneName":  cfg.ZONE_NAME,
        "online":    is_online(),
        "queueSize": sync_queue.size(),
        "hasData":   _latest is not None,
    })


@app.route("/api/snapshot")
def api_snapshot():
    snap = _latest or db_snaps.latest(cfg.ZONE_ID)
    if not snap:
        return jsonify({"error": "No data yet"}), 404
    return jsonify(snap)


@app.route("/api/history")
def api_history():
    limit = min(int(request.args.get("limit", 24)), 200)
    return jsonify(db_snaps.history(cfg.ZONE_ID, limit))


# CORS — allows frontend to poll directly
@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"]  = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type,X-API-Key"
    return r


def start_local_server():
    t = threading.Thread(
        target=lambda: app.run(
            host="0.0.0.0", port=cfg.LOCAL_PORT, debug=False, use_reloader=False
        ),
        daemon=True
    )
    t.start()
    print(f"[local-server] http://0.0.0.0:{cfg.LOCAL_PORT}")