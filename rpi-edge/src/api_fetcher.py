import csv
import io
import math
import requests
from datetime import datetime, timedelta
from config import cfg
from db     import cache

TIMEOUT = 10   # seconds per request


# ────────────────────────────────────────────────────────────────────
# 1. OpenWeatherMap — replicates weather.js fetchWeather()
# ────────────────────────────────────────────────────────────────────
def fetch_weather():+
    KEY = f"weather:{cfg.ZONE_ID}"

    try:
        if not cfg.OPENWEATHER_KEY:
            raise ValueError("OPENWEATHER_KEY not set")

        cr = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat":   cfg.LAT,
                "lon":   cfg.LON,
                "appid": cfg.OPENWEATHER_KEY,
                "units": "metric",
            },
            timeout=TIMEOUT
        )
        cr.raise_for_status()
        c = cr.json()

        fr = requests.get(
            "https://api.openweathermap.org/data/2.5/forecast",
            params={
                "lat":   cfg.LAT,
                "lon":   cfg.LON,
                "appid": cfg.OPENWEATHER_KEY,
                "units": "metric",
                "cnt":   40,
            },
            timeout=TIMEOUT
        )

        rainfall = c.get("rain", {}).get("1h", 0.0)
        humidity = c["main"]["humidity"]
        temp     = c["main"]["temp"]

        moisture_score = min(100, round(
            humidity * 0.6 + min(rainfall, 20) / 20 * 40
        ))

        forecast = []
        if fr.ok:
            by_day = {}
            for slot in fr.json().get("list", []):
                # ✅ FIXED — %b %d works on Windows (%-d is Linux only)
                day = datetime.fromtimestamp(slot["dt"]).strftime("%b %d")
                if day not in by_day:
                    by_day[day] = {
                        "temps": [], "humidities": [],
                        "rain": 0, "conditions": []
                    }
                by_day[day]["temps"].append(slot["main"]["temp"])
                by_day[day]["humidities"].append(slot["main"]["humidity"])
                by_day[day]["rain"] += slot.get("rain", {}).get("3h", 0)
                by_day[day]["conditions"].append(
                    slot["weather"][0]["main"] if slot.get("weather") else "Unknown"
                )

            for day, d in list(by_day.items())[:7]:
                top = max(set(d["conditions"]), key=d["conditions"].count)
                forecast.append({
                    "date":      day,
                    "tempMax":   round(max(d["temps"])),
                    "tempMin":   round(min(d["temps"])),
                    "humidity":  round(sum(d["humidities"]) / len(d["humidities"])),
                    "rain":      round(d["rain"] * 10) / 10,
                    "condition": top,
                })

        data = {
            "temp":          round(temp),
            "humidity":      humidity,
            "rainfall":      rainfall,
            "windSpeed":     round(c["wind"]["speed"] * 10) / 10,
            "condition":     c["weather"][0]["main"] if c.get("weather") else "Unknown",
            "moistureScore": moisture_score,
            "forecast":      forecast,
        }

        cache.set(KEY, data)
        return data, "OpenWeatherMap"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[weather] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[weather] No data — {e}")
        return {
            "temp": 30, "humidity": 50, "rainfall": 0,
            "windSpeed": 3.0, "condition": "Unknown",
            "moistureScore": 40, "forecast": []
        }, "mock"


# ────────────────────────────────────────────────────────────────────
# 2. NASA FIRMS — replicates firms.js fetchFireEvents()
# ────────────────────────────────────────────────────────────────────
def fetch_fire_events(days=2):
    KEY  = f"firms:{cfg.ZONE_ID}"
    bbox = cfg.BBOX
    area = f"{bbox['minLon']},{bbox['minLat']},{bbox['maxLon']},{bbox['maxLat']}"

    safe_days = min(max(1, days), 5)

    try:
        if not cfg.FIRMS_KEY:
            raise ValueError("FIRMS_KEY not set")

        url = (
            f"https://firms.modaps.eosdis.nasa.gov/api/area/csv"
            f"/{cfg.FIRMS_KEY}/VIIRS_SNPP_NRT/{area}/{safe_days}"
        )
        r = requests.get(url, timeout=12)
        r.raise_for_status()

        reader = csv.reader(io.StringIO(r.text.strip()))
        rows   = list(reader)
        points = []
        for row in rows[1:]:
            if not row:
                continue
            try:
                points.append({
                    "lat":        float(row[0]),
                    "lon":        float(row[1]),
                    "brightness": float(row[2]),
                    "confidence": row[8].strip() if len(row) > 8 else "",
                })
            except (IndexError, ValueError):
                continue

        data = {"count": len(points), "points": points}
        cache.set(KEY, data)
        return data, "NASA FIRMS"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[firms] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[firms] No data — {e}")
        return {"count": 0, "points": []}, "mock"


# ────────────────────────────────────────────────────────────────────
# 3. GBIF — replicates gbif.js fetchSpeciesCount()
# ────────────────────────────────────────────────────────────────────
def fetch_species_count():
    KEY  = f"gbif:{cfg.ZONE_ID}"
    bbox = cfg.BBOX

    try:
        r = requests.get(
            "https://api.gbif.org/v1/occurrence/search",
            params={
                "decimalLatitude":  f"{bbox['minLat']},{bbox['maxLat']}",
                "decimalLongitude": f"{bbox['minLon']},{bbox['maxLon']}",
                "facet":            "speciesKey",
                "facetLimit":       "200",
                "limit":            "0",
            },
            timeout=TIMEOUT
        )
        r.raise_for_status()
        j = r.json()

        data = {
            "speciesCount":    len(j.get("facets", [{}])[0].get("counts", [])),
            "occurrenceCount": j.get("count", 0),
        }
        cache.set(KEY, data)
        return data, "GBIF"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[gbif] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[gbif] No data — {e}")
        return {"speciesCount": 80, "occurrenceCount": 0}, "mock"


# ────────────────────────────────────────────────────────────────────
# 4. eBird — replicates ebird.js fetchBirdActivity()
# ────────────────────────────────────────────────────────────────────
def fetch_bird_activity(radius_km=25, back=7):
    KEY = f"ebird:{cfg.ZONE_ID}"

    try:
        if not cfg.EBIRD_KEY:
            raise ValueError("EBIRD_KEY not set")

        r = requests.get(
            "https://api.ebird.org/v2/data/obs/geo/recent",
            params={
                "lat":        cfg.LAT,
                "lng":        cfg.LON,
                "dist":       radius_km,
                "back":       back,
                "maxResults": 200,
            },
            headers={"X-eBirdApiToken": cfg.EBIRD_KEY},
            timeout=TIMEOUT
        )
        r.raise_for_status()
        obs         = r.json()
        species_set = set(o["speciesCode"] for o in obs)

        data = {
            "observationCount": len(obs),
            "speciesCount":     len(species_set),
            "score": min(100, round((len(species_set) / 120) * 100)),
        }
        cache.set(KEY, data)
        return data, "eBird"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[ebird] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[ebird] No data — {e}")
        return {"observationCount": 0, "speciesCount": 55, "score": 50}, "mock"


# ────────────────────────────────────────────────────────────────────
# 5. Copernicus NDVI — replicates ndvi.js fetchNDVI()
# ────────────────────────────────────────────────────────────────────
def fetch_ndvi():
    KEY       = f"ndvi:{cfg.ZONE_ID}"
    STALE_MIN = 12 * 60

    if cache.age_minutes(KEY) < STALE_MIN:
        cached = cache.get(KEY)
        if cached:
            return cached["data"], "mock"

    try:
        if not cfg.COPERNICUS_CLIENT_ID:
            raise ValueError("Copernicus credentials not set")

        token     = _get_copernicus_token()
        today     = datetime.utcnow()
        from_date = (today - timedelta(days=14)).strftime("%Y-%m-%d")
        to_date   = today.strftime("%Y-%m-%d")
        bbox      = cfg.BBOX

        evalscript = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  var ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.000001);
  if (ndvi < -1) ndvi = -1;
  if (ndvi > 1)  ndvi = 1;
  return { ndvi: [ndvi], dataMask: [1] };
}"""

        body = {
            "input": {
                "bounds": {
                    "bbox": [
                        bbox["minLon"], bbox["minLat"],
                        bbox["maxLon"], bbox["maxLat"]
                    ],
                    "properties": {
                        "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                    },
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": f"{from_date}T00:00:00Z",
                            "to":   f"{to_date}T23:59:59Z",
                        },
                        "maxCloudCoverage": 80,
                    },
                }],
            },
            "aggregation": {
                "timeRange": {
                    "from": f"{from_date}T00:00:00Z",
                    "to":   f"{to_date}T23:59:59Z",
                },
                "aggregationInterval": {"of": "P7D"},
                "evalscript": evalscript,
            },
        }

        r = requests.post(
            "https://services.sentinel-hub.com/api/v1/statistics",
            json=body,
            headers={
                "Authorization":  f"Bearer {token}",
                "Content-Type":   "application/json",
                "Accept":         "application/json",
            },
            timeout=20
        )
        r.raise_for_status()
        intervals = r.json().get("data", [])

        ndvi_scaled = None
        for interval in reversed(intervals):
            mean = (interval
                    .get("outputs", {})
                    .get("ndvi", {})
                    .get("bands", {})
                    .get("B0", {})
                    .get("stats", {})
                    .get("mean"))
            if mean is not None and mean == mean:
                ndvi_scaled = round(((mean + 1) / 2) * 100)
                break

        if ndvi_scaled is None:
            raise ValueError("No valid NDVI intervals in response")

        cache.set(KEY, ndvi_scaled)
        return ndvi_scaled, "Copernicus"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[ndvi] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[ndvi] No data — {e}")
        return 60, "mock"


# ────────────────────────────────────────────────────────────────────
# 6. Copernicus Tree Cover — replicates gfw.js fetchTreeCoverLoss()
# ────────────────────────────────────────────────────────────────────
def fetch_tree_cover():
    KEY       = f"gfw:{cfg.ZONE_ID}"
    STALE_MIN = 12 * 60

    if cache.age_minutes(KEY) < STALE_MIN:
        cached = cache.get(KEY)
        if cached:
            return cached["data"], "mock"

    try:
        if not cfg.COPERNICUS_CLIENT_ID:
            raise ValueError("Copernicus credentials not set")

        token     = _get_copernicus_token()
        today     = datetime.utcnow()
        from_date = (today - timedelta(days=14)).strftime("%Y-%m-%d")
        to_date   = today.strftime("%Y-%m-%d")
        bbox      = cfg.BBOX

        evalscript = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "tree_cover", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask",   bands: 1, sampleType: "UINT8"   }
    ]
  }
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.000001)
  return { tree_cover: [ndvi > 0.4 ? 1 : 0], dataMask: [s.dataMask] }
}"""

        body = {
            "input": {
                "bounds": {
                    "bbox": [
                        bbox["minLon"], bbox["minLat"],
                        bbox["maxLon"], bbox["maxLat"]
                    ],
                    "properties": {
                        "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                    },
                },
                "data": [{
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {
                            "from": f"{from_date}T00:00:00Z",
                            "to":   f"{to_date}T23:59:59Z",
                        },
                        "maxCloudCoverage": 30,
                    },
                }],
            },
            "aggregation": {
                "timeRange": {
                    "from": f"{from_date}T00:00:00Z",
                    "to":   f"{to_date}T23:59:59Z",
                },
                "aggregationInterval": {"of": "P7D"},
                "evalscript": evalscript,
            },
        }

        r = requests.post(
            "https://services.sentinel-hub.com/api/v1/statistics",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=20
        )
        r.raise_for_status()
        intervals = r.json().get("data", [])

        if not intervals:
            raise ValueError("No intervals returned")

        def _pct(interval):
            return round(
                (interval
                 .get("outputs", {})
                 .get("tree_cover", {})
                 .get("bands", {})
                 .get("B0", {})
                 .get("stats", {})
                 .get("mean", 0.5)) * 100
            )

        latest_pct   = _pct(intervals[-1])
        earliest_pct = _pct(intervals[0])
        loss_pct     = max(0, earliest_pct - latest_pct)

        lat_diff = bbox["maxLat"] - bbox["minLat"]
        lon_diff = bbox["maxLon"] - bbox["minLon"]
        area_km2 = (
            lat_diff * 111
            * lon_diff * 111
            * math.cos(math.radians((bbox["minLat"] + bbox["maxLat"]) / 2))
        )
        area_ha       = area_km2 * 100
        total_loss_ha = round(area_ha * (loss_pct / 100))

        data = {
            "treeCoverPct": latest_pct,
            "totalLossHa":  total_loss_ha,
            "coverLossPct": max(0, min(100, 100 - loss_pct * 5)),
            "yearlyLoss": [
                {
                    "period":   i + 1,
                    "coverPct": _pct(d),
                }
                for i, d in enumerate(intervals)
            ],
        }
        cache.set(KEY, data)
        return data, "Copernicus Land"

    except Exception as e:
        cached = cache.get(KEY)
        if cached:
            print(f"[gfw] Cache fallback — {e}")
            return cached["data"], "mock"
        print(f"[gfw] No data — {e}")
        return {
            "treeCoverPct": 70, "totalLossHa": 1000,
            "coverLossPct": 70, "yearlyLoss": []
        }, "mock"


# ────────────────────────────────────────────────────────────────────
# Shared helper
# ────────────────────────────────────────────────────────────────────
def _get_copernicus_token():
    r = requests.post(
        "https://services.sentinel-hub.com/oauth/token",
        data={
            "grant_type":    "client_credentials",
            "client_id":     cfg.COPERNICUS_CLIENT_ID,
            "client_secret": cfg.COPERNICUS_CLIENT_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=TIMEOUT
    )
    r.raise_for_status()
    return r.json()["access_token"]
