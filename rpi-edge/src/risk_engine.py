from config import cfg

WEIGHTS = {
    "temperature":    0.20,
    "humidity":       0.20,
    "wind_speed":     0.15,
    "rainfall":       0.15,
    "fire_proximity": 0.20,
    "ndvi":           0.10,
}

RECOMMENDATIONS = {
    "MINIMAL":  "Routine monitoring. No action required.",
    "LOW":      "Increase patrol frequency. Check 48-hour forecast.",
    "MODERATE": "Deploy standby patrol. Pre-position water tankers. Issue community advisory.",
    "HIGH":     "Activate fire response protocol. Deploy field teams. Notify SDRF.",
    "CRITICAL": "Full emergency activation. Aerial recon requested. Notify District Collector.",
}


def compute_assessment(weather: dict, firms: dict, ndvi: dict,
                       weather_src: str, firms_src: str, ndvi_src: str) -> dict:

    t   = weather["temperature"]
    h   = weather["humidity"]
    w   = weather["wind_speed"]
    r   = weather["rainfall_1h"]
    ndv = ndvi["ndvi_mean"]

    # Normalise each factor to [0, 1] — higher = more risk
    T_norm = _clamp((t - 15) / 35)
    H_norm = 1 - _clamp(h / 100)
    W_norm = _clamp(w / 20)
    R_norm = 1 - _clamp(r / 5)
    V_norm = _clamp((0.8 - ndv) / 0.8)

    # Fire proximity: distance + confidence combined
    F_norm = 0.0
    if firms["closest_km"] is not None:
        dist_score  = _clamp((100 - firms["closest_km"]) / 100)
        conf_weight = firms["max_confidence"] / 100
        F_norm = dist_score * conf_weight

    factors = {
        "temperature":    {"norm": round(T_norm, 3), "raw": t,                         "unit": "°C",   "weight": WEIGHTS["temperature"]},
        "humidity":       {"norm": round(H_norm, 3), "raw": h,                         "unit": "%",    "weight": WEIGHTS["humidity"]},
        "wind_speed":     {"norm": round(W_norm, 3), "raw": w,                         "unit": "m/s",  "weight": WEIGHTS["wind_speed"]},
        "rainfall":       {"norm": round(R_norm, 3), "raw": r,                         "unit": "mm/h", "weight": WEIGHTS["rainfall"]},
        "fire_proximity": {"norm": round(F_norm, 3), "raw": firms["closest_km"],       "unit": "km",   "weight": WEIGHTS["fire_proximity"]},
        "ndvi":           {"norm": round(V_norm, 3), "raw": ndv,                       "unit": "",     "weight": WEIGHTS["ndvi"]},
    }

    frs = round(100 * sum(f["weight"] * f["norm"] for f in factors.values()), 1)
    frs = max(0.0, min(100.0, frs))

    level      = _classify(frs)
    top_factors = _rank_factors(factors)
    explanation = _explain(top_factors, frs, level, weather, firms, ndvi)

    return {
        "zone_id":        cfg.ZONE_ID,
        "zone_name":      cfg.ZONE_NAME,
        "device_id":      cfg.DEVICE_ID,
        "frs":            frs,
        "level":          level,
        "factors":        factors,
        "top_factors":    top_factors,
        "explanation":    explanation,
        "recommendation": RECOMMENDATIONS[level],
        "data_source": {
            "weather": weather_src,
            "firms":   firms_src,
            "ndvi":    ndvi_src,
        },
    }


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))

def _classify(frs: float) -> str:
    if frs >= 81: return "CRITICAL"
    if frs >= 61: return "HIGH"
    if frs >= 41: return "MODERATE"
    if frs >= 21: return "LOW"
    return "MINIMAL"

def _rank_factors(factors: dict) -> list:
    ranked = sorted(
        [{"name": k, "contribution": round(v["weight"] * v["norm"] * 100, 1),
          "raw": v["raw"], "unit": v["unit"]}
         for k, v in factors.items()],
        key=lambda x: x["contribution"],
        reverse=True
    )
    return ranked[:3]

def _explain(top: list, frs: float, level: str, weather, firms, ndvi) -> str:
    parts = []
    for f in top:
        n = f["name"]
        if n == "temperature":    parts.append(f"temperature {weather['temperature']}°C")
        elif n == "humidity":     parts.append(f"low humidity ({weather['humidity']}%)")
        elif n == "wind_speed":   parts.append(f"wind speed {weather['wind_speed']} m/s")
        elif n == "rainfall":     parts.append("no recent rainfall")
        elif n == "fire_proximity" and firms["closest_km"]:
            parts.append(f"active hotspot {firms['closest_km']:.0f} km away ({firms['max_confidence']}% confidence)")
        elif n == "ndvi":         parts.append(f"dry vegetation (NDVI {ndvi['ndvi_mean']})")
    return f"Risk score {frs} — {level}. Primary drivers: {', '.join(parts)}."