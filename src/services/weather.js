/**
 * OpenWeatherMap — Current weather & forecast
 * API Docs: https://openweathermap.org/current  (v2.5 — free tier)
 *
 * NOTE: One Call v3.0 requires a paid subscription — not used here.
 *
 * Environment variables required:
 *   VITE_OPENWEATHER_API_KEY
 *
 * Weather is cached separately from zone data with a 20-minute TTL,
 * so it stays fresh even when the main zone cache is hours old.
 */

const BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://api.openweathermap.org/data/2.5'

// ── Independent weather cache — 20 min TTL ────────────────────────────────
// Stored separately from zone cache so rain/temp updates without a full refetch.
const WEATHER_CACHE_KEY = 'vandrishti_weather_cache'
const WEATHER_TTL_MS    = 20 * 60 * 1000   // 20 minutes

function getWeatherCache(lat, lon) {
  try {
    const raw  = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) return null
    const all  = JSON.parse(raw)
    const key  = `${lat.toFixed(3)},${lon.toFixed(3)}`
    const entry = all[key]
    if (!entry) return null
    if (Date.now() - entry.fetchedAt > WEATHER_TTL_MS) return null   // stale
    return entry.data
  } catch { return null }
}

function setWeatherCache(lat, lon, data) {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    const all = raw ? JSON.parse(raw) : {}
    const key = `${lat.toFixed(3)},${lon.toFixed(3)}`
    all[key]  = { fetchedAt: Date.now(), data }
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(all))
  } catch {}
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract rainfall in mm from an OWM weather/forecast object.
 * OWM reports rain as rain['1h'], rain['3h'], or omits the key entirely
 * (even during active precipitation, depending on station reporting).
 * Snow is reported similarly and counts toward moisture.
 */
function extractPrecipitation(obj) {
  return (
    obj?.rain?.['1h'] ??
    obj?.rain?.['3h'] ??
    obj?.snow?.['1h'] ??
    obj?.snow?.['3h'] ??
    0
  )
}

/**
 * Map an OWM condition string to a readable label + emoji icon.
 */
export function weatherIcon(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('thunder'))                              return { icon: '⛈', label: 'Thunderstorm' }
  if (c.includes('drizzle'))                              return { icon: '🌦', label: 'Drizzle' }
  if (c.includes('rain'))                                 return { icon: '🌧', label: 'Rain' }
  if (c.includes('snow'))                                 return { icon: '❄️', label: 'Snow' }
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return { icon: '🌫', label: 'Haze / Fog' }
  if (c.includes('smoke') || c.includes('dust'))          return { icon: '💨', label: 'Smoke / Dust' }
  if (c.includes('tornado'))                              return { icon: '🌪', label: 'Tornado' }
  if (c.includes('clear'))                                return { icon: '☀️', label: 'Clear' }
  if (c.includes('cloud'))                                return { icon: '⛅', label: 'Cloudy' }
  return { icon: '🌤', label: condition || 'Unknown' }
}

/**
 * Generate a realistic 5-day mock forecast — used when API is unavailable.
 */
function buildMockForecast(temp, humidity, rainfall) {
  const conditions = ['Clear', 'Clouds', 'Clouds', 'Rain', 'Clear']
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1)
    const v = (i % 3 - 1) * 2
    return {
      date:      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tempMax:   Math.round(temp + Math.abs(v) + 2),
      tempMin:   Math.round(temp - Math.abs(v) - 1),
      humidity:  Math.min(100, Math.max(20, humidity + (i % 2 === 0 ? 5 : -5))),
      rain:      i === 2 ? Math.round(rainfall * 2 + 2) : 0,
      condition: conditions[i],
    }
  })
}

// ── Main fetch ─────────────────────────────────────────────────────────────

/**
 * Fetch current weather and 5-day forecast for a lat/lon.
 * Returns cached data if fetched within the last 20 minutes.
 */
export async function fetchWeather(lat, lon) {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY
  if (!key) {
    console.warn('[Weather] No VITE_OPENWEATHER_API_KEY — returning null (mock will be used).')
    return null
  }

  // Return fresh cached data if available — avoids burning API quota
  const cached = getWeatherCache(lat, lon)
  if (cached) {
    console.debug(`[Weather] Cache hit for ${lat},${lon}`)
    return cached
  }

  const currentParams  = new URLSearchParams({ lat, lon, appid: key, units: 'metric' })
  const forecastParams = new URLSearchParams({ lat, lon, appid: key, units: 'metric', cnt: 40 })

  let currentRes, forecastRes
  try {
    ;[currentRes, forecastRes] = await Promise.all([
      fetch(`${BASE_URL}/weather?${currentParams}`),
      fetch(`${BASE_URL}/forecast?${forecastParams}`),
    ])
  } catch (err) {
    console.error('[Weather] Network error:', err.message)
    return null
  }

  if (!currentRes.ok) {
    const body = await currentRes.text().catch(() => '')
    console.error(`[Weather] ${currentRes.status}: ${body.slice(0, 120)}`)
    return null
  }

  const current = await currentRes.json()

  // ── Rainfall: check 1h, then 3h, then snow, then 0 ─────────────────────
  // OWM omits the rain key entirely when precipitation is 0 OR when the
  // station hasn't reported yet (common with light/starting rain).
  // Checking all variants prevents showing 0 during active rain.
  const rainfall = extractPrecipitation(current)

  const humidity = current.main.humidity
  const temp     = current.main.temp

  const moistureScore = Math.min(100, Math.round(
    (humidity * 0.6) + (Math.min(rainfall, 20) / 20 * 40)
  ))

  // ── 5-day forecast from 3h slots ──────────────────────────────────────
  let forecast = []
  if (forecastRes.ok) {
    const fData = await forecastRes.json()
    const byDay = {}
    for (const slot of (fData.list || [])) {
      const day = new Date(slot.dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDay[day]) byDay[day] = { temps: [], humidities: [], rain: 0, conditions: [] }
      byDay[day].temps.push(slot.main.temp)
      byDay[day].humidities.push(slot.main.humidity)
      // Use extractPrecipitation for forecast slots too
      byDay[day].rain += extractPrecipitation(slot)
      byDay[day].conditions.push(slot.weather?.[0]?.main ?? 'Unknown')
    }
    forecast = Object.entries(byDay).slice(0, 5).map(([date, d]) => ({
      date,
      tempMax:   Math.round(Math.max(...d.temps)),
      tempMin:   Math.round(Math.min(...d.temps)),
      humidity:  Math.round(d.humidities.reduce((a, b) => a + b, 0) / d.humidities.length),
      rain:      Math.round(d.rain * 10) / 10,
      condition: d.conditions.sort(
        (a, b) => d.conditions.filter(v => v === b).length - d.conditions.filter(v => v === a).length
      )[0],
    }))
  }

  if (!forecast.length) forecast = buildMockForecast(Math.round(temp), humidity, rainfall)

  const result = {
    temp:         Math.round(temp),
    humidity,
    rainfall,
    windSpeed:    Math.round((current.wind?.speed ?? 0) * 10) / 10,
    condition:    current.weather?.[0]?.main ?? 'Unknown',
    description:  current.weather?.[0]?.description ?? '',
    feelsLike:    Math.round(current.main.feels_like ?? temp),
    pressure:     current.main.pressure ?? null,
    visibility:   current.visibility != null ? Math.round(current.visibility / 1000) : null,
    cloudCover:   current.clouds?.all ?? null,
    sunrise:      current.sys?.sunrise ? new Date(current.sys.sunrise * 1000)
                    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
    sunset:       current.sys?.sunset  ? new Date(current.sys.sunset  * 1000)
                    .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
    moistureScore,
    forecast,
    // Timestamp so UI can show "weather updated X min ago"
    weatherFetchedAt: new Date().toISOString(),
  }

  // Cache it with a 20-min TTL
  setWeatherCache(lat, lon, result)
  return result
}