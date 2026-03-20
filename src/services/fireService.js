/**
 * VanDrishti — Fire Weather Service
 *
 * Fetches fire-relevant weather from Open-Meteo (free, no API key).
 * Returns a shape that ZoneDetail.jsx consumes directly.
 *
 * Returned object shape:
 * {
 *   current:  { fwi, risk, tempMax, rhMin, wind, rain }
 *   summary:  { currentRisk, maxFwi30d, peakDay, avgFwi30d,
 *               trend, peakForecast, peakForecastDay }
 *   history:  Day[]   ← past 30 days
 *   forecast: Day[]   ← next 7 days
 * }
 *
 * Day: { date, label, fwi, risk, tempMax, rhMin, wind, rain }
 *
 * FWI model: simplified Canadian Fire Weather Index
 *   risk.level: 0=Very Low 1=Low 2=Moderate 3=High 4=Very High 5=Extreme
 *   Matches legend in ZoneDetail: 0-5 / 5-12 / 12-20 / 20-30 / 30-38 / 38+
 */

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

export function fwiRisk(fwi) {
  if (fwi >= 38) return { label: 'Extreme',   color: '#7C0000', bg: 'rgba(124,0,0,0.10)',    short: 'EXTREME',   level: 5 }
  if (fwi >= 30) return { label: 'Very High', color: '#DC3545', bg: 'rgba(220,53,69,0.10)',  short: 'VERY HIGH', level: 4 }
  if (fwi >= 20) return { label: 'High',      color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  short: 'HIGH',      level: 3 }
  if (fwi >= 12) return { label: 'Moderate',  color: '#D97706', bg: 'rgba(217,119,6,0.10)',  short: 'MODERATE',  level: 2 }
  if (fwi >= 5)  return { label: 'Low',       color: '#84CC16', bg: 'rgba(132,204,22,0.10)', short: 'LOW',       level: 1 }
  return               { label: 'Very Low',   color: '#22A95C', bg: 'rgba(34,169,92,0.10)',  short: 'VERY LOW',  level: 0 }
}

function computeFWI({ tempMax, rhMin, windMax, rainMm }) {
  const t  = Math.min(50,  Math.max(0, tempMax ?? 25))
  const rh = Math.min(100, Math.max(0, rhMin   ?? 50))
  const w  = Math.min(100, Math.max(0, windMax ?? 10))
  const r  = Math.min(50,  Math.max(0, rainMm  ?? 0))
  const ffmc   = Math.max(0, t * 0.6 - rh * 0.25 + 10)
  const drought= Math.max(0, 20 - r * 1.5)
  const wind   = w * 0.15
  return Math.min(60, Math.max(0, Math.round((ffmc + drought + wind) * 10) / 10))
}

function trendSlope(values) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  values.forEach((v, i) => { num += (i - xMean) * (v - yMean); den += (i - xMean) ** 2 })
  return den === 0 ? 0 : Math.round((num / den) * 100) / 100
}

function shortLabel(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export async function fetchFireWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    past_days: 30, forecast_days: 7,
    daily: [
      'temperature_2m_max', 'relative_humidity_2m_min',
      'wind_speed_10m_max', 'precipitation_sum',
    ].join(','),
  })

  let res
  try { res = await fetch(`${OPEN_METEO}?${params}`) }
  catch (err) { console.error('[fireService] Network error:', err.message); return null }
  if (!res.ok) { console.error('[fireService] API error:', res.status); return null }

  const json = await res.json()
  const d = json.daily
  if (!d?.time?.length) return null

  const todayStr = new Date().toISOString().slice(0, 10)

  const allDays = d.time.map((date, i) => {
    const tempMax = d.temperature_2m_max?.[i]       ?? null
    const rhMin   = d.relative_humidity_2m_min?.[i] ?? null
    const windMax = d.wind_speed_10m_max?.[i]        ?? null
    const rain    = d.precipitation_sum?.[i]         ?? 0
    const fwi     = computeFWI({ tempMax, rhMin, windMax, rainMm: rain })
    return {
      date,
      label:    shortLabel(date),
      fwi,
      risk:     fwiRisk(fwi),
      tempMax:  tempMax != null ? Math.round(tempMax)           : null,
      rhMin:    rhMin   != null ? Math.round(rhMin)             : null,
      wind:     windMax != null ? Math.round(windMax * 10) / 10 : null,
      rain:     rain    != null ? Math.round(rain * 10) / 10    : 0,
      isFuture: date > todayStr,
    }
  })

  const history  = allDays.filter(d => !d.isFuture)
  const forecast = allDays.filter(d => d.isFuture).slice(0, 7)
  const currentDay = history[history.length - 1] ?? allDays[0]

  const fwiValues = history.map(d => d.fwi)
  const maxFwi30d = Math.max(...fwiValues)
  const avgFwi30d = Math.round(fwiValues.reduce((s, v) => s + v, 0) / fwiValues.length)
  const peakDay   = history.find(d => d.fwi === maxFwi30d) ?? null
  const slope     = trendSlope(fwiValues.slice(-10))
  const trend     = slope > 0.5 ? 'worsening' : slope < -0.5 ? 'improving' : 'stable'
  const peakForecastDay = forecast.reduce((b, d) => !b || d.fwi > b.fwi ? d : b, null)

  return {
    current: {
      fwi: currentDay.fwi, risk: currentDay.risk,
      tempMax: currentDay.tempMax, rhMin: currentDay.rhMin,
      wind: currentDay.wind, rain: currentDay.rain,
    },
    summary: {
      currentRisk: currentDay.risk,
      maxFwi30d, peakDay, avgFwi30d, trend,
      peakForecast:    peakForecastDay?.fwi ?? 0,
      peakForecastDay,
    },
    history,
    forecast,
  }
}

// Alias kept for any legacy imports
export const fetchFireData = fetchFireWeather