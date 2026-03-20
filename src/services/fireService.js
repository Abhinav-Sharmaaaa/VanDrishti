/**
 * VanDrishti — Fire Weather Service
 *
 * Implements the Canadian Fire Weather Index (FWI) System
 * Source: Van Wagner, C.E. (1987). Development and Structure of the
 *         Canadian Forest Fire Weather Index System. Forestry Technical
 *         Report 35. Canadian Forestry Service, Ottawa.
 *
 * Components (computed iteratively day-by-day):
 *   FFMC  Fine Fuel Moisture Code   — surface litter dryness (0–101)
 *   DMC   Duff Moisture Code        — upper organic layer dryness
 *   DC    Drought Code              — deep organic layer / drought accumulation
 *   ISI   Initial Spread Index      — fire spread rate (FFMC + wind)
 *   BUI   Build-Up Index            — total fuel available (DMC + DC)
 *   FWI   Fire Weather Index        — overall fire intensity (ISI + BUI)
 *
 * Why iterative? DC and DMC accumulate drought over weeks. A single-day
 * formula cannot produce accurate results — you must run through all prior
 * days to get correct moisture codes.
 *
 * We fetch 45 days of history (15 warm-up + 30 display) + 7-day forecast
 * from Open-Meteo, spin up moisture codes from standard start values.
 *
 * Output shape consumed by ZoneDetail.jsx:
 * {
 *   current:  { fwi, ffmc, dmc, dc, isi, bui, risk, tempMax, rhMin, wind, rain }
 *   summary:  { currentRisk, maxFwi30d, peakDay, avgFwi30d,
 *               trend, peakForecast, peakForecastDay }
 *   history:  Day[]
 *   forecast: Day[]
 * }
 * Day: { date, label, fwi, ffmc, dmc, dc, isi, bui, risk, tempMax, rhMin, wind, rain }
 */

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'

// ---------------------------------------------------------------------------
// Risk bands — matches ZoneDetail.jsx legend exactly
// ---------------------------------------------------------------------------
export function fwiRisk(fwi) {
  if (fwi >= 38) return { label: 'Extreme',   color: '#7C0000', bg: 'rgba(124,0,0,0.10)',    short: 'EXTREME',   level: 5 }
  if (fwi >= 30) return { label: 'Very High', color: '#DC3545', bg: 'rgba(220,53,69,0.10)',  short: 'VERY HIGH', level: 4 }
  if (fwi >= 20) return { label: 'High',      color: '#EA580C', bg: 'rgba(234,88,12,0.10)',  short: 'HIGH',      level: 3 }
  if (fwi >= 12) return { label: 'Moderate',  color: '#D97706', bg: 'rgba(217,119,6,0.10)',  short: 'MODERATE',  level: 2 }
  if (fwi >= 5)  return { label: 'Low',       color: '#84CC16', bg: 'rgba(132,204,22,0.10)', short: 'LOW',       level: 1 }
  return               { label: 'Very Low',   color: '#22A95C', bg: 'rgba(34,169,92,0.10)',  short: 'VERY LOW',  level: 0 }
}

// ---------------------------------------------------------------------------
// Day-length factors — Van Wagner 1987, Table 1, latitude band 30°N
// (covers Corbett 29.5°N, reasonable for Sundarbans 21.9°N too)
// ---------------------------------------------------------------------------
const LE = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0]  // DMC Le
const LF = [-1.6,-1.6,-1.6, 0.9,  3.8,  5.8,  6.4,  5.0, 2.4, 0.4,-1.6,-1.6]  // DC  Lf

// ---------------------------------------------------------------------------
// FFMC — Fine Fuel Moisture Code (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcFFMC(T, H, W, ro, Fo) {
  let mo = 147.2 * (101 - Fo) / (59.5 + Fo)
  if (ro > 0.5) {
    const rf = ro - 0.5
    let mr = mo <= 150
      ? mo + 42.5 * rf * Math.exp(-100/(251-mo)) * (1 - Math.exp(-6.93/rf))
      : mo + 42.5 * rf * Math.exp(-100/(251-mo)) * (1 - Math.exp(-6.93/rf))
           + 0.0015 * (mo-150)**2 * Math.sqrt(rf)
    mo = Math.min(mr, 250)
  }
  const Ed = 0.942*H**0.679 + 11*Math.exp((H-100)/10) + 0.18*(21.1-T)*(1-Math.exp(-0.115*H))
  const Ew = 0.618*H**0.753 + 10*Math.exp((H-100)/10) + 0.18*(21.1-T)*(1-Math.exp(-0.115*H))
  let m
  if (mo > Ed) {
    const ko = 0.424*(1-(H/100)**1.7) + 0.0694*Math.sqrt(W)*(1-(H/100)**8)
    m = Ed + (mo-Ed) * 10**(-ko * 0.581 * Math.exp(0.0365*T))
  } else if (mo < Ew) {
    const kl = 0.424*(1-((100-H)/100)**1.7) + 0.0694*Math.sqrt(W)*(1-((100-H)/100)**8)
    m = Ew - (Ew-mo) * 10**(-kl * 0.581 * Math.exp(0.0365*T))
  } else {
    m = mo
  }
  return Math.min(101, Math.max(0, 59.5*(250-m)/(147.2+m)))
}

// ---------------------------------------------------------------------------
// DMC — Duff Moisture Code (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcDMC(T, H, ro, Po, month) {
  let P = Po
  if (ro > 1.5) {
    const re = 0.92*ro - 1.27
    const Mo = 20 + Math.exp(5.6348 - Po/43.43)
    const b  = Po <= 33 ? 100/(0.5+0.3*Po) : Po <= 65 ? 14-1.3*Math.log(Po) : 6.2*Math.log(Po)-17.2
    const Mr = Mo + 1000*re/(48.77 + b*re)
    P = Math.max(0, 244.72 - 43.43*Math.log(Mr-20))
  }
  if (T > -1.1) P += 100 * 1.894*(T+1.1)*(100-H)*LE[month]*1e-6
  return Math.max(0, P)
}

// ---------------------------------------------------------------------------
// DC — Drought Code (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcDC(T, ro, Do, month) {
  let D = Do
  if (ro > 2.8) {
    const rd = 0.83*ro - 1.27
    const Qr = 800*Math.exp(-Do/400) + 3.937*rd
    D = Math.max(0, 400*Math.log(800/Qr))
  }
  if (T > -2.8) D += 0.5 * Math.max(0, 0.36*(T+2.8) + LF[month])
  return Math.max(0, D)
}

// ---------------------------------------------------------------------------
// ISI — Initial Spread Index (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcISI(ffmc, W) {
  const m  = 147.2*(101-ffmc)/(59.5+ffmc)
  const fF = 91.9*Math.exp(-0.1386*m)*(1 + m**5.31/4.93e7)
  return Math.max(0, 0.208 * Math.exp(0.05039*W) * fF)
}

// ---------------------------------------------------------------------------
// BUI — Build-Up Index (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcBUI(dmc, dc) {
  const bui = dmc <= 0.4*dc
    ? 0.8*dmc*dc / (dmc + 0.4*dc)
    : dmc - (1 - 0.8*dc/(dmc+0.4*dc)) * (0.92 + (0.0114*dmc)**1.7)
  return Math.max(0, bui)
}

// ---------------------------------------------------------------------------
// FWI — Fire Weather Index (Van Wagner 1987)
// ---------------------------------------------------------------------------
function calcFWI(isi, bui) {
  const fD = bui <= 80 ? 0.626*bui**0.809 + 2 : 1000/(25+108.64*Math.exp(-0.023*bui))
  const B  = 0.1 * isi * fD
  return Math.max(0, B > 1 ? Math.exp(2.72*(0.434*Math.log(B))**0.647) : B)
}

// ---------------------------------------------------------------------------
// Run FWI iteratively over all days
// ---------------------------------------------------------------------------
function iterateFWI(days) {
  let ffmc = 85, dmc = 6, dc = 15   // Van Wagner standard startup values
  return days.map(day => {
    const T  = day.tempMax ?? 25
    const H  = Math.min(100, Math.max(0, day.rhMin ?? 50))
    const W  = Math.max(0, day.wind ?? 15)
    const ro = Math.max(0, day.rain ?? 0)
    const mo = day.month
    ffmc = calcFFMC(T, H, W, ro, ffmc)
    dmc  = calcDMC(T, H, ro, dmc, mo)
    dc   = calcDC(T, ro, dc, mo)
    const isi = calcISI(ffmc, W)
    const bui = calcBUI(dmc, dc)
    const fwi = calcFWI(isi, bui)
    return { ...day, ffmc, dmc, dc, isi, bui, fwi, risk: fwiRisk(Math.round(fwi)) }
  })
}

// ---------------------------------------------------------------------------
// Trend slope
// ---------------------------------------------------------------------------
function trendSlope(values) {
  const n = values.length
  if (n < 2) return 0
  const xMean = (n-1)/2
  const yMean = values.reduce((s,v)=>s+v,0)/n
  let num=0, den=0
  values.forEach((v,i)=>{ num+=(i-xMean)*(v-yMean); den+=(i-xMean)**2 })
  return den===0 ? 0 : Math.round(num/den*100)/100
}

function shortLabel(dateStr) {
  return new Date(dateStr+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric'})
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export async function fetchFireWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto',
    past_days: 45,       // 15 warm-up + 30 display
    forecast_days: 7,
    wind_speed_unit: 'kmh',  // FWI equations require km/h
    daily: [
      'temperature_2m_max',
      'relative_humidity_2m_min',
      'wind_speed_10m_max',
      'precipitation_sum',
    ].join(','),
  })

  let res
  try { res = await fetch(`${OPEN_METEO}?${params}`) }
  catch (err) { console.error('[fireService] Network error:', err.message); return null }
  if (!res.ok) { console.error('[fireService] API error:', res.status); return null }

  const json = await res.json()
  const d    = json.daily
  if (!d?.time?.length) return null

  const todayStr = new Date().toISOString().slice(0,10)

  const rawDays = d.time.map((date, i) => ({
    date,
    label:    shortLabel(date),
    month:    new Date(date+'T12:00:00Z').getMonth(),
    tempMax:  d.temperature_2m_max?.[i]       ?? null,
    rhMin:    d.relative_humidity_2m_min?.[i] ?? null,
    wind:     d.wind_speed_10m_max?.[i]       ?? null,
    rain:     d.precipitation_sum?.[i]        ?? 0,
    isFuture: date > todayStr,
  }))

  const computed = iterateFWI(rawDays)

  // Drop warm-up days, keep last 30 history + 7 forecast
  const displayStart = computed.length - 7 - 30
  const displayDays  = computed.slice(Math.max(0, displayStart))
  const history      = displayDays.filter(d => !d.isFuture)
  const forecast     = displayDays.filter(d => d.isFuture).slice(0, 7)

  const fmt = days => days.map(day => ({
    date:    day.date,
    label:   day.label,
    fwi:     Math.round(day.fwi),
    ffmc:    Math.round(day.ffmc),
    dmc:     Math.round(day.dmc),
    dc:      Math.round(day.dc),
    isi:     Math.round(day.isi * 10) / 10,
    bui:     Math.round(day.bui),
    risk:    day.risk,
    tempMax: day.tempMax != null ? Math.round(day.tempMax) : null,
    rhMin:   day.rhMin   != null ? Math.round(day.rhMin)   : null,
    wind:    day.wind    != null ? Math.round(day.wind)    : null,
    rain:    day.rain    != null ? Math.round(day.rain * 10) / 10 : 0,
    isFuture:day.isFuture,
  }))

  const histFmt = fmt(history)
  const foreFmt = fmt(forecast)
  const cur     = histFmt[histFmt.length - 1] ?? histFmt[0]

  const fwiVals = histFmt.map(d => d.fwi)
  const maxFwi30d = Math.max(...fwiVals)
  const avgFwi30d = Math.round(fwiVals.reduce((s,v)=>s+v,0)/fwiVals.length)
  const peakDay   = histFmt.find(d => d.fwi === maxFwi30d) ?? null
  const slope     = trendSlope(fwiVals.slice(-10))
  const trend     = slope > 0.5 ? 'worsening' : slope < -0.5 ? 'improving' : 'stable'
  const peakForecastDay = foreFmt.reduce((b,d) => !b||d.fwi>b.fwi ? d : b, null)

  return {
    current: {
      fwi: cur.fwi, ffmc: cur.ffmc, dmc: cur.dmc, dc: cur.dc,
      isi: cur.isi, bui: cur.bui,   risk: cur.risk,
      tempMax: cur.tempMax, rhMin: cur.rhMin, wind: cur.wind, rain: cur.rain,
    },
    summary: {
      currentRisk: cur.risk, maxFwi30d, peakDay, avgFwi30d, trend,
      peakForecast:    peakForecastDay?.fwi ?? 0,
      peakForecastDay,
    },
    history:  histFmt,
    forecast: foreFmt,
  }
}

export const fetchFireData = fetchFireWeather