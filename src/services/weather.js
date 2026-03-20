const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

const WMO = {
  0:  { label: 'Clear',               icon: '☀️' },
  1:  { label: 'Mainly Clear',        icon: '🌤' },
  2:  { label: 'Partly Cloudy',       icon: '⛅' },
  3:  { label: 'Overcast',            icon: '☁️' },
  45: { label: 'Foggy',               icon: '🌫' },
  48: { label: 'Icy Fog',             icon: '🌫' },
  51: { label: 'Light Drizzle',       icon: '🌦' },
  53: { label: 'Drizzle',             icon: '🌦' },
  55: { label: 'Heavy Drizzle',       icon: '🌧' },
  61: { label: 'Light Rain',          icon: '🌧' },
  63: { label: 'Rain',                icon: '🌧' },
  65: { label: 'Heavy Rain',          icon: '🌧' },
  71: { label: 'Light Snow',          icon: '❄️' },
  73: { label: 'Snow',                icon: '❄️' },
  75: { label: 'Heavy Snow',          icon: '🌨' },
  77: { label: 'Snow Grains',         icon: '🌨' },
  80: { label: 'Light Showers',       icon: '🌦' },
  81: { label: 'Showers',             icon: '🌧' },
  82: { label: 'Heavy Showers',       icon: '⛈' },
  85: { label: 'Snow Showers',        icon: '🌨' },
  86: { label: 'Heavy Snow Shower',   icon: '🌨' },
  95: { label: 'Thunderstorm',        icon: '⛈' },
  96: { label: 'Thunderstorm + Hail', icon: '⛈' },
  99: { label: 'Heavy Thunderstorm',  icon: '⛈' },
}

function wmoInfo(code) {
  return WMO[code] ?? { label: 'Unknown', icon: '🌤' }
}

/**
 * Map condition string to icon — compatible with any UI that calls weatherIcon().
 */
export function weatherIcon(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('thunder'))                      return { icon: '⛈', label: condition }
  if (c.includes('snow') || c.includes('grains')) return { icon: '❄️', label: condition }
  if (c.includes('shower') || c.includes('rain')) return { icon: '🌧', label: condition }
  if (c.includes('drizzle'))                      return { icon: '🌦', label: condition }
  if (c.includes('fog') || c.includes('icy'))     return { icon: '🌫', label: condition }
  if (c.includes('overcast'))                     return { icon: '☁️', label: condition }
  if (c.includes('cloud'))                        return { icon: '⛅', label: condition }
  if (c.includes('clear') || c.includes('sunny')) return { icon: '☀️', label: condition }
  return { icon: '🌤', label: condition || 'Unknown' }
}

export async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:  lat,
    longitude: lon,
    timezone:  'auto',

    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'surface_pressure',
      'cloud_cover',
      'visibility',
    ].join(','),

    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'relative_humidity_2m_max',
      'sunrise',
      'sunset',
    ].join(','),

    forecast_days: 5,
  })

  let res
  try {
    res = await fetch(`${BASE_URL}?${params}`)
  } catch (err) {
    console.error('[Weather/Open-Meteo] Network error:', err.message)
    return null
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[Weather/Open-Meteo] ${res.status}: ${body.slice(0, 120)}`)
    return null
  }

  const data = await res.json()
  const cur  = data.current
  const day  = data.daily

  if (!cur || !day) {
    console.error('[Weather/Open-Meteo] Unexpected response:', JSON.stringify(data).slice(0, 200))
    return null
  }

  const temp       = Math.round(cur.temperature_2m ?? 0)
  const humidity   = Math.round(cur.relative_humidity_2m ?? 0)
  // Open-Meteo: precipitation = mm in the past hour (same semantics as OWM rain.1h)
  const rainfall   = cur.precipitation ?? 0
  const windSpeed  = Math.round((cur.wind_speed_10m ?? 0) * 10) / 10
  const feelsLike  = Math.round(cur.apparent_temperature ?? temp)
  const pressure   = cur.surface_pressure ?? null
  const cloudCover = cur.cloud_cover ?? null
  const visibility = cur.visibility != null ? Math.round(cur.visibility / 1000) : null
  const wmo        = wmoInfo(cur.weather_code)

  // Sunrise/sunset come as ISO strings like "2025-03-20T06:12"
  const fmt = iso => iso
    ? new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null
  const sunrise = fmt(day.sunrise?.[0])
  const sunset  = fmt(day.sunset?.[0])

  // Moisture score — identical formula, works better now since rainfall is never missing
  const moistureScore = Math.min(100, Math.round(
    (humidity * 0.6) + (Math.min(rainfall, 20) / 20 * 40)
  ))

  // 5-day forecast
  const forecast = (day.weather_code || []).map((code, i) => {
    const dateStr = day.sunrise?.[i]
      ? new Date(day.sunrise[i]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : `Day ${i + 1}`
    return {
      date:      dateStr,
      tempMax:   Math.round(day.temperature_2m_max?.[i] ?? temp + 2),
      tempMin:   Math.round(day.temperature_2m_min?.[i] ?? temp - 3),
      humidity:  Math.round(day.relative_humidity_2m_max?.[i] ?? humidity),
      rain:      Math.round((day.precipitation_sum?.[i] ?? 0) * 10) / 10,
      rainProb:  day.precipitation_probability_max?.[i] ?? 0,  // % chance of rain — bonus field
      condition: wmoInfo(code).label,
      icon:      wmoInfo(code).icon,
    }
  })

  return {
    temp,
    humidity,
    rainfall,
    windSpeed,
    condition:   wmo.label,
    icon:        wmo.icon,
    description: wmo.label.toLowerCase(),
    feelsLike,
    pressure,
    visibility,
    cloudCover,
    sunrise,
    sunset,
    moistureScore,
    forecast,
  }
}