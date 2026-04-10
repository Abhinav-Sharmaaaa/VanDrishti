<div align="center">
  <img alt="VanDrishti" width="180" src="https://placehold.co/180x180/0f2613/4ade80?text=VD">
</div>

# VanDrishti

Real-time forest health monitoring for India's wildlife reserves.

VanDrishti aggregates satellite imagery, fire alerts, biodiversity records, and weather data across Jim Corbett National Park and the Sundarbans into a single operational dashboard. A Raspberry Pi node handles on-ground sensor telemetry.

Built for **Yukti 2026**.

---

## Requirements

- Node.js 18 or higher
- npm 9 or higher
- API keys for OpenWeatherMap, NASA FIRMS, eBird, Global Forest Watch, and Copernicus CDSE
- Python 3 (for the Raspberry Pi sensor node, optional)

---

## Installation

```sh
git clone https://github.com/<your-username>/vandrishti.git
cd vandrishti
npm install
```

---

## Configuration

Create a `.env` file in the project root:

```env
VITE_OPENWEATHER_API_KEY=
VITE_NASA_FIRMS_API_KEY=
VITE_EBIRD_API_KEY=
VITE_GFW_API_KEY=
VITE_COPERNICUS_CLIENT_ID=
VITE_COPERNICUS_CLIENT_SECRET=
```

A `.env.example` template is included in the repo.

> GBIF does not require an API key for public access.

---

## Quickstart

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## RPi Sensor Node

```sh
cd rpi
pip install -r requirements.txt
python sensor_server.py
```

The sensor server streams temperature, humidity, and air quality readings to the dashboard backend.

---

## Features

**Satellite Vegetation Index** — NDVI and land cover derived from ESA Sentinel-2 imagery via the Copernicus Data Space Ecosystem.

**Fire Hotspot Detection** — Active fire overlays sourced from NASA FIRMS with temporal filtering.

**Deforestation Alerts** — Tree cover loss and canopy change data from Global Forest Watch.

**Biodiversity Records** — Species occurrences from GBIF and recent bird sightings from eBird, filtered to the selected area of interest.

**Weather Layer** — Live conditions, humidity, and precipitation from OpenWeatherMap.

**AOI Selection** — React-Leaflet map with two-click rectangle draw and Nominatim place search for selecting a custom area of interest.

**Smart Caching** — Centralized localStorage cache to deduplicate API calls across sessions.

---

## Monitored Reserves

| Reserve | State | Area |
|---|---|---|
| Jim Corbett National Park | Uttarakhand | 1,318 km² |
| Sundarbans Biosphere Reserve | West Bengal | 9,630 km² |

---

## Building

```sh
npm run build
```

Output is in the `dist/` folder. Preview the production build:

```sh
npm run preview
```

---

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React-Leaflet](https://react-leaflet.js.org/)
- [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/)
- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/)
- [Global Forest Watch](https://www.globalforestwatch.org/)
- [GBIF](https://www.gbif.org/)
- [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59)
- [OpenWeatherMap](https://openweathermap.org/api)

---

## Team

| Name | Role |
|---|---|
| [Abhinav](https://github.com/AbhinavGoyal-BigStep) | Project Lead |
| [ritik0436](https://github.com/ritik0436) | Frontend Developer |
| [Arya017-Stack](https://github.com/Arya017-Stack) | QA & Bug Fixes |
| [nikstack20](https://github.com/nikstack20) | Backend & RPi Integration |

---

## License

MIT
