import os
import time
import signal
import schedule

from config           import cfg
from api_fetcher      import (
    fetch_weather, fetch_fire_events,
    fetch_species_count, fetch_bird_activity,
    fetch_ndvi, fetch_tree_cover
)
from fhi_engine       import compute_fhi, get_status, build_snapshot
from db               import snapshots, sync_queue
from alert_controller import set_alert, cleanup as gpio_cleanup
from local_server     import start_local_server, set_latest
from network_monitor  import check_once, on_online, is_online
from sync_service     import enqueue, flush


def run_cycle():
    print(f"\n[cycle] {time.strftime('%Y-%m-%d %H:%M:%S')}")
    t0 = time.time()

    try:
        # ── Fetch all 6 APIs (same as dataService.js fetchZoneData) ──
        weather,      w_src = fetch_weather()
        fire,         f_src = fetch_fire_events(days=2)
        species_data, s_src = fetch_species_count()
        bird_data,    b_src = fetch_bird_activity()
        ndvi,         n_src = fetch_ndvi()
        gfw,          g_src = fetch_tree_cover()

        print(f"[cycle] Sources — "
              f"weather:{w_src} firms:{f_src} "
              f"gbif:{s_src} ebird:{b_src} "
              f"ndvi:{n_src} gfw:{g_src}")

        # ── Compute FHI — exact same formula as dataService.js ───────
        fhi, species_score = compute_fhi(
            ndvi          = ndvi,
            fire_count    = fire["count"],
            species_count = species_data["speciesCount"],
            bird_score    = bird_data["score"],
            moisture_score = weather["moistureScore"],
            cover_loss_pct = gfw["coverLossPct"],
        )
        status = get_status(fhi)
        print(f"[cycle] FHI={fhi} status={status}")

        # ── Build snapshot object ─────────────────────────────────────
        snap = build_snapshot(
            fhi           = fhi,
            status        = status,
            ndvi          = ndvi,
            fire          = fire,
            species_count = species_data["speciesCount"],
            bird_data     = bird_data,
            weather       = weather,
            gfw           = gfw,
            species_score = species_score,
            data_source   = {
                "ndvi":      n_src,
                "fire":      f_src,
                "species":   s_src,
                "birds":     b_src,
                "weather":   w_src,
                "treeCover": g_src,
            },
        )

        # ── Store locally ─────────────────────────────────────────────
        snapshots.insert(snap)

        # ── Drive GPIO alerts ─────────────────────────────────────────
        set_alert(status)

        # ── Update local Flask dashboard ──────────────────────────────
        set_latest(snap)

        # ── Sync to backend ───────────────────────────────────────────
        enqueue(snap)
        if is_online():
            flush()
        else:
            print(f"[cycle] Offline — queue size: {sync_queue.size()}")

        print(f"[cycle] Done in {time.time() - t0:.1f}s")

    except Exception as e:
        print(f"[cycle] ERROR: {e}")
        # Never crash — next scheduled cycle will retry


def _on_network_restored():
    print("[main] Network restored — flushing queue")
    flush()


def main():
    os.makedirs(
        os.path.join(os.path.dirname(__file__), "../data"),
        exist_ok=True
    )

    print(f"\nVanDrishti RPi Edge Node")
    print(f"Device  : {cfg.DEVICE_ID}")
    print(f"Zone    : {cfg.ZONE_NAME}")
    print(f"Location: {cfg.LAT}°N, {cfg.LON}°E")
    print(f"Backend : {cfg.BACKEND_URL}")
    print(f"Interval: {cfg.FETCH_INTERVAL_SEC}s\n")

    # Start local HTTP server (always accessible, even offline)
    start_local_server()

    # Initial network check
    check_once()

    # Register network callbacks
    on_online(_on_network_restored)

    # First cycle immediately
    run_cycle()

    # Schedule repeating cycles
    schedule.every(cfg.FETCH_INTERVAL_SEC).seconds.do(run_cycle)
    schedule.every(cfg.SYNC_INTERVAL_SEC).seconds.do(check_once)

    # Graceful shutdown
    def _shutdown(sig, frame):
        print("\n[main] Shutting down…")
        gpio_cleanup()
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    # Main loop
    while True:
        schedule.run_pending()
        time.sleep(1)


if __name__ == "__main__":
    main()