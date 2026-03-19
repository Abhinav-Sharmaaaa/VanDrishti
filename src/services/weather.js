/**
 * OpenWeatherMap — Current weather & forecast
 * API Docs: https://openweathermap.org/current  (v2.5 — free tier)
 *
 * NOTE: One Call v3.0 (data/3.0/onecall) requires a paid subscription.
 * This module uses the free current-weather + forecast endpoints instead.
 *
 * Environment variables required:
 *   VITE_OPENWEATHER_API_KEY
 */

// Vite proxy: /api/* → https://api.openweathermap.org/data/2.5/*
const BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://api.openweathermap.org/data/2.5'

/**
 * Fetch current weather and 7-day forecast for a lat/lon.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{
 *   temp: number,        // °C
 *   humidity: number,    // %
 *   rainfall: number,    // mm last 1h (0 if none)
 *   windSpeed: number,   // m/s
 *   condition: string,   // e.g. 'Clear', 'Rain'
 *   moistureScore: number, // 0–100 derived moisture health score
 *   forecast: Array      // 7-day daily summary
 * }>}
 */
export async function fetchWeather(lat, lon) {
  const key = import.meta.env.VITE_OPENWEATHER_API_KEY
  if (!key) {
    console.warn('[Weather] No OpenWeatherMap API key. Returning mock data.')
    return null
  }

  const currentParams = new URLSearchParams({ lat, lon, appid: key, units: 'metric' })
  // /forecast returns 5 days of 3-hour slots — free on all tiers
  // /forecast/daily (16-day) requires a paid subscription → do NOT use
  const forecastParams = new URLSearchParams({ lat, lon, appid: key, units: 'metric', cnt: 40 })

  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?${currentParams}`),
    fetch(`${BASE_URL}/forecast?${forecastParams}`),
  ])

  if (!currentRes.ok) {
    console.error('[Weather] Current weather API error', currentRes.status)
    return null
  }

  const current = await currentRes.json()
  const rainfall = current.rain?.['1h'] ?? 0
  const humidity = current.main.humidity
  const temp = current.main.temp

  const moistureScore = Math.min(100, Math.round(
    (humidity * 0.6) + (Math.min(rainfall, 20) / 20 * 40)
  ))

  // Group 3-hour slots into daily summaries (free /forecast endpoint)
  let forecast = []
  if (forecastRes.ok) {
    const fData = await forecastRes.json()
    const byDay = {}
    for (const slot of (fData.list || [])) {
      const day = new Date(slot.dt * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (!byDay[day]) byDay[day] = { temps: [], humidities: [], rain: 0, conditions: [] }
      byDay[day].temps.push(slot.main.temp)
      byDay[day].humidities.push(slot.main.humidity)
      byDay[day].rain += slot.rain?.['3h'] ?? 0
      byDay[day].conditions.push(slot.weather?.[0]?.main ?? 'Unknown')
    }
    forecast = Object.entries(byDay).slice(0, 7).map(([date, d]) => ({
      date,
      tempMax: Math.round(Math.max(...d.temps)),
      tempMin: Math.round(Math.min(...d.temps)),
      humidity: Math.round(d.humidities.reduce((a, b) => a + b, 0) / d.humidities.length),
      rain: Math.round(d.rain * 10) / 10,
      // Pick the most common condition for the day
      condition: d.conditions.sort((a, b) =>
        d.conditions.filter(v => v === b).length - d.conditions.filter(v => v === a).length
      )[0],
    }))
  }

  return {
    temp: Math.round(temp),
    humidity,
    rainfall,
    windSpeed: Math.round(current.wind.speed * 10) / 10,
    condition: current.weather?.[0]?.main ?? 'Unknown',
    moistureScore,
    forecast,
  }
}