import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Zone identity
    DEVICE_ID  = os.getenv("DEVICE_ID",  "rpi-corbett-a")
    ZONE_ID    = os.getenv("ZONE_ID",    "corbett-a")
    ZONE_NAME  = os.getenv("ZONE_NAME",  "Corbett Zone A")
    LAT        = float(os.getenv("LAT",  "29.53"))
    LON        = float(os.getenv("LON",  "78.77"))

    # Bounding box — same as BUILTIN_ZONES in dataService.js
    BBOX = {
        "minLon": float(os.getenv("BBOX_MIN_LON", "78.6")),
        "minLat": float(os.getenv("BBOX_MIN_LAT", "29.4")),
        "maxLon": float(os.getenv("BBOX_MAX_LON", "78.9")),
        "maxLat": float(os.getenv("BBOX_MAX_LAT", "29.7")),
    }

    # API keys — same values, no VITE_ prefix
    OPENWEATHER_KEY          = os.getenv("OPENWEATHER_KEY",          "")
    FIRMS_KEY                = os.getenv("FIRMS_KEY",                "")
    EBIRD_KEY                = os.getenv("EBIRD_KEY",                "")
    COPERNICUS_CLIENT_ID     = os.getenv("COPERNICUS_CLIENT_ID",     "")
    COPERNICUS_CLIENT_SECRET = os.getenv("COPERNICUS_CLIENT_SECRET", "")

    # Backend (teammate ka Express server)
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
    BACKEND_KEY = os.getenv("BACKEND_KEY", "dev-key")

    # Local Postgres on Pi
    DATABASE_URL = os.getenv(
        "DATABASE_URL",
        "postgresql://vannetra:vannetra_pass@localhost:5432/vannetra_rpi"
    )

    # Timing
    FETCH_INTERVAL_SEC = int(os.getenv("FETCH_INTERVAL_SEC", "300"))
    SYNC_INTERVAL_SEC  = int(os.getenv("SYNC_INTERVAL_SEC",  "30"))
    LOCAL_PORT         = int(os.getenv("LOCAL_PORT",         "8080"))

    # GPIO pins (BCM numbering)
    GPIO_GREEN  = int(os.getenv("GPIO_GREEN",  "17"))
    GPIO_AMBER  = int(os.getenv("GPIO_AMBER",  "27"))
    GPIO_RED    = int(os.getenv("GPIO_RED",    "22"))
    GPIO_BUZZER = int(os.getenv("GPIO_BUZZER", "18"))

cfg = Config()