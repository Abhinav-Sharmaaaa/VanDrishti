from datetime import datetime
from config import cfg

# ── Exact replica of dataService.js computeFHI() ────────────────────
def compute_fhi(ndvi, fire_count, species_count,
                bird_score, moisture_score, cover_loss_pct):
    """
    dataService.js:
        Math.min(100, ndvi)              * 0.30
        Math.max(0, 100 - fireCount*5)  * 0.20
        Math.min(100, speciesScore)      * 0.15
        Math.min(100, birdScore)         * 0.10
        Math.min(100, moistureScore)     * 0.15
        Math.min(100, coverLossPct)      * 0.10
    """
    # speciesScore — same formula as dataService.js
    species_score = min(100, round(
        (species_count / 150) * 60 + bird_score * 0.4
    ))

    fhi = (
        min(100, ndvi)                  * 0.30 +
        max(0,   100 - fire_count * 5)  * 0.20 +
        min(100, species_score)         * 0.15 +
        min(100, bird_score)            * 0.10 +
        min(100, moisture_score)        * 0.15 +
        min(100, cover_loss_pct)        * 0.10
    )
    return max(0, min(100, round(fhi))), species_score


# ── Exact replica of dataService.js getStatus() ─────────────────────
def get_status(fhi: int) -> str:
    if fhi >= 60: return "healthy"
    if fhi >= 40: return "watch"
    if fhi >= 20: return "alert"
    return "critical"


# ── Build snapshot — same shape as dataService.js fetchZoneData() ───
def build_snapshot(fhi, status, ndvi, fire, species_count,
                   bird_data, weather, gfw, species_score, data_source):
    """
    Returns exact same object shape as dataService.js fetchZoneData()
    so the frontend can consume it without any transformation.
    """
    fire_count   = fire["count"]
    bird_score   = bird_data.get("score", 50)
    bird_species = bird_data.get("speciesCount", 55)

    return {
        # Top-level fields — same as fetchZoneData() return
        "id":          cfg.ZONE_ID,
        "name":        cfg.ZONE_NAME,
        "deviceId":    cfg.DEVICE_ID,
        "coords":      f"{cfg.LAT}°N, {cfg.LON}°E",
        "fhi":         fhi,
        "status":      status,
        "custom":      False,

        # signals — same keys as dataService.js
        "signals": {
            "ndvi":         ndvi,
            "biodiversity": species_score,
            "thermalRisk":  min(100, fire_count * 5),
            "moisture":     weather["moistureScore"],
            "coverHealth":  gfw["coverLossPct"],
        },

        # weather — same shape as weather.js return value
        "weather": weather,

        # fire — same shape as firms.js return value
        "fire": {
            "count":  fire_count,
            "points": fire.get("points", []),
        },

        # species — same shape as dataService.js
        "species": {
            "count":       species_count,
            "birdSpecies": bird_species,
        },

        # treeCover — same shape as gfw.js return value
        "treeCover": gfw,

        # dataSource — same keys as dataService.js
        "dataSource": {
            "ndvi":      data_source["ndvi"],
            "fire":      data_source["fire"],
            "species":   data_source["species"],
            "birds":     data_source["birds"],
            "weather":   data_source["weather"],
            "treeCover": data_source["treeCover"],
        },

        "lastUpdated": datetime.utcnow().isoformat() + "Z",
    }