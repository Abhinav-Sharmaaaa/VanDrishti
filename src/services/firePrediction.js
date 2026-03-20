const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

// ---------------------------------------------------------------------------
// FWI risk band
// ---------------------------------------------------------------------------
export function fwiRisk(fwi) {
  if (fwi >= 80) return { label: 'Extreme',   color: '#7F1D1D', bg: 'rgba(127,29,29,0.12)',  short: 'EXTREME'   }
  if (fwi >= 60) return { label: 'Very High', color: '#DC3545', bg: 'rgba(220,53,69,0.12)',  short: 'VERY HIGH' }
  if (fwi >= 40) return { label: 'High',      color: '#EA580C', bg: 'rgba(234,88,12,0.12)',  short: 'HIGH'      }
  if (fwi >= 20) return { label: 'Moderate',  color: '#D97706', bg: 'rgba(217,119,6,0.12)',  short: 'MODERATE'  }
  return               { label: 'Low',        color: '#22A95C', bg: 'rgba(34,169,92,0.12)',  short: 'LOW'       }
}

// ---------------------------------------------------------------------------
// Simplified FWI from Open-Meteo daily variables
// ---------------------------------------------------------------------------
function computeFWI({ tempMax, rhMin, windMax, rainMm, et0 }) {
  const t = Math.min(50, Math.max(0, tempMax ?? 25))
  const h = Math.min(100, Math.max(0, rhMin    ?? 50))
  const w = Math.min(60,  Math.max(0, windMax  ?? 5))
  const r = Math.min(30,  Math.max(0, rainMm   ?? 0))
  const e = Math.min(10,  Math.max(0, et0      ?? 3))

  const tempScore   = (t / 50) * 100
  const humidScore  = 100 - h                        // low humidity = high risk
  const windScore   = (w / 60) * 100
  const droughtScore= Math.max(0, 100 - (r / 0.3))  // 30 mm+ = no drought risk
  const et0Score    = (e / 10) * 100                 // evapotranspiration demand

  return Math.min(100, Math.max(0, Math.round(
    tempScore    * 0.28 +
    humidScore   * 0.28 +
    windScore    * 0.18 +
    droughtScore * 0.16 +
    et0Score     * 0.10
  )))
}

// ---------------------------------------------------------------------------
// Estimate fire event count from FWI (used for days where FIRMS has no data)
// Historical FIRMS only goes 5 days back on a MAP_KEY, so we estimate the rest.
// ---------------------------------------------------------------------------
function estimateFireCount(fwi, seed = 1) {
  // Deterministic pseudo-random so chart is stable across re-renders
  const r = ((seed * 1664525 + 1013904223) & 0xffffffff) >>> 0
  const noise = (r / 0xffffffff) * 0.4 - 0.2  // ±20% noise

  if (fwi >= 80) return Math.round(12 + fwi * 0.15 * (1 + noise))
  if (fwi >= 60) return Math.round(6  + fwi * 0.08 * (1 + noise))
  if (fwi >= 40) return Math.round(2  + fwi * 0.04 * (1 + noise))
  if (fwi >= 20) return Math.round(    fwi * 0.02 * (1 + noise))
  return 0
}

// ---------------------------------------------------------------------------
// Trend slope — simple linear regression over last N values
// Returns slope per day (positive = worsening)
// ---------------------------------------------------------------------------
function trendSlope(values) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n - 1) / 2
  const yMean = values.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  values.forEach((v, i) => {
    num += (i - xMean) * (v - yMean)
    den += (i - xMean) ** 2
  })
  return den === 0 ? 0 : num / den
}

export async function fetchFireData(lat, lon, currentFireCount = 0) {
  const params = new URLSearchParams({
    latitude:     lat,
    longitude:    lon,
    timezone:     'auto',
    past_days:    30,
    forecast_days:16,
    daily: [
      'temperature_2m_max',
      'relative_humidity_2m_min',
      'wind_speed_10m_max',
      'precipitation_sum',
      'et0_fao_evapotranspiration',
      'precipitation_probability_max',
    ].join(','),
  })

  let res
  try {
    res = await fetch(`${OPEN_METEO}?${params}`)
  } catch (err) {
    console.error('[FirePrediction] Network error:', err.message)
    return null
  }

  if (!res.ok) {
    console.error('[FirePrediction] Open-Meteo error:', res.status)
    return null
  }

  const json = await res.json()
  const d    = json.daily
  if (!d?.time?.length) return null

  const dates   = d.time
  const todayStr= new Date().toISOString().slice(0, 10)
  const todayIdx= dates.findIndex(dt => dt >= todayStr)

  const allDays = dates.map((date, i) => {
    const tempMax = d.temperature_2m_max?.[i]
    const rhMin   = d.relative_humidity_2m_min?.[i]
    const windMax = d.wind_speed_10m_max?.[i]
    const rain    = d.precipitation_sum?.[i]
    const et0     = d.et0_fao_evapotranspiration?.[i]
    const rainProb= d.precipitation_probability_max?.[i] ?? null

    const fwi       = computeFWI({ tempMax, rhMin, windMax, rainMm: rain, et0 })
    const isFuture  = date > todayStr
    // Use actual FIRMS count for today; estimate for all other days
    const fireCount = date === todayStr
      ? currentFireCount
      : estimateFireCount(fwi, i * 7919 + Math.round(lat * 100) + Math.round(lon * 100))

    return {
      date,
      label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fwi,
      fireCount,
      tempMax:  tempMax != null ? Math.round(tempMax) : null,
      rhMin:    rhMin   != null ? Math.round(rhMin)   : null,
      windMax:  windMax != null ? Math.round(windMax * 10) / 10 : null,
      rain:     rain    != null ? Math.round(rain * 10) / 10 : 0,
      rainProb,
      isFuture,
    }
  })

  const history  = allDays.filter(d => !d.isFuture)
  const forecast = allDays.filter(d => d.isFuture)
  const todayData= history[history.length - 1] ?? allDays[0]
  const currentFWI = todayData?.fwi ?? 0

  // Trend: slope of last 10 historical FWI values
  const last10    = history.slice(-10).map(d => d.fwi)
  const slope     = trendSlope(last10)
  const trend     = slope >  1.5 ? 'worsening'
                  : slope < -1.5 ? 'improving'
                  : 'stable'

  // Peak forecast day
  const peakDay = forecast.reduce((best, d) => !best || d.fwi > best.fwi ? d : best, null)

  // Risk factor breakdown for today
  const td = todayData
  const riskFactors = {
    temp:     td?.tempMax != null ? Math.round((Math.min(50, td.tempMax) / 50) * 100) : 50,
    humidity: td?.rhMin   != null ? Math.round(100 - td.rhMin)                        : 50,
    wind:     td?.windMax != null ? Math.round((Math.min(60, td.windMax) / 60) * 100) : 30,
    drought:  td?.rain    != null ? Math.round(Math.max(0, 100 - td.rain * 3.3))      : 50,
  }

  return {
    currentFWI,
    currentRisk: fwiRisk(currentFWI),
    history,
    forecast,
    trend,
    trendSlope: Math.round(slope * 10) / 10,
    peakFwiDay: peakDay ? { date: peakDay.label, fwi: peakDay.fwi } : null,
    riskFactors,
  }
}