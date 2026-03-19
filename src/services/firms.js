/**
 * NASA FIRMS — Fire Information for Resource Management System
 * API Docs: https://firms.modaps.eosdis.nasa.gov/api/
 *
 * Environment variables required:
 *   VITE_NASA_FIRMS_KEY
 *
 * NOTE: Free MAP_KEY accounts are limited to days 1–5.
 * Full API keys support up to 10 days.
 */

// Vite proxy: /firms/* → https://firms.modaps.eosdis.nasa.gov/api/area/csv/*
const BASE_URL = import.meta.env.DEV
  ? '/firms'
  : 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'

/**
 * Fetch fire/thermal event count for a bounding box.
 * @param {Object} bbox   - { minLon, minLat, maxLon, maxLat }
 * @param {number} days   - Days to look back. MAP_KEY max = 5; full API key max = 10.
 * @param {string} source - FIRMS data source identifier
 */
export async function fetchFireEvents(bbox, days = 2, source = 'VIIRS_SNPP_NRT') {
  const key = import.meta.env.VITE_NASA_FIRMS_KEY
  if (!key) {
    console.warn('[FIRMS] No NASA FIRMS key. Returning mock data.')
    return null
  }

  // Clamp to MAP_KEY safe range — change upper bound to 10 if you have a full API key
  const safeDays = Math.min(Math.max(1, days), 5)

  const area = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`
  const url  = `${BASE_URL}/${key}/${source}/${area}/${safeDays}`

  let res
  try {
    res = await fetch(url)
  } catch (err) {
    console.error('[FIRMS] Network error', err.message)
    return null
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    console.error(`[FIRMS] ${res.status} — ${body}`)
    return null
  }

  const csv   = await res.text()
  const lines = csv.trim().split('\n').slice(1).filter(l => l.trim())
  if (!lines.length) return { count: 0, points: [] }

  const points = lines.map(line => {
    const c = line.split(',')
    return { lat: parseFloat(c[0]), lon: parseFloat(c[1]), brightness: parseFloat(c[2]), confidence: c[8] ?? '' }
  })

  return { count: points.length, points }
}