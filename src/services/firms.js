/**
 * NASA FIRMS — Fire Information for Resource Management System
 * API Docs: https://firms.modaps.eosdis.nasa.gov/api/
 *
 * Environment variables required:
 *   VITE_NASA_FIRMS_KEY
 *
 * NASA FIRMS returns 500 when:
 *   - The requested source is temporarily unavailable or deprecated
 *   - The MAP_KEY has hit its daily transaction limit (approx 500/day)
 *   - The bbox spans an area with no recent data for that satellite pass
 *
 * Fix: try sources in priority order, fall back gracefully on each 500.
 * MAP_KEY accounts work with MODIS_NRT and VIIRS_NOAA20_NRT most reliably.
 */

// NASA FIRMS supports CORS — call directly in dev and prod.
// Do NOT proxy through Vite: if vite.config.js lacks the /firms rule,
// Vite itself returns 500 before the request reaches NASA.
const BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'

/**
 * Source priority list — most reliable for free MAP_KEY accounts first.
 * VIIRS_SNPP_NRT is deprioritised because it frequently 500s on MAP_KEY accounts.
 */
const SOURCE_PRIORITY = [
  'MODIS_NRT',         // MODIS Terra+Aqua — most stable for MAP_KEY
  'VIIRS_NOAA20_NRT',  // NOAA-20 VIIRS — good coverage, usually available
  'VIIRS_SNPP_NRT',    // Suomi NPP — often unavailable on free keys, try last
]

/**
 * Attempt a single FIRMS fetch for a given source.
 * Returns parsed result on success, or null with a reason on failure.
 */
async function fetchFromSource(key, source, area, safeDays) {
  const url = `${BASE_URL}/${key}/${source}/${area}/${safeDays}`

  let res
  try {
    res = await fetch(url)
  } catch (err) {
    console.warn(`[FIRMS] Network error (${source}):`, err.message)
    return null
  }

  if (res.status === 500) {
    const body = await res.text().catch(() => '')
    console.warn(`[FIRMS] 500 from ${source} — trying next source. Detail: ${body.slice(0, 80) || '(empty)'}`)
    return null   // caller will try next source
  }

  if (res.status === 429) {
    console.error('[FIRMS] Rate limit hit — daily transaction quota exceeded for this MAP_KEY.')
    return null
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '(unreadable)')
    console.error(`[FIRMS] ${res.status} from ${source}: ${body.slice(0, 120)}`)
    return null
  }

  const csv   = await res.text()
  const lines = csv.trim().split('\n').slice(1).filter(l => l.trim())

  if (!lines.length) return { count: 0, points: [], source }

  const points = lines.map(line => {
    const c = line.split(',')
    return {
      lat:        parseFloat(c[0]),
      lon:        parseFloat(c[1]),
      brightness: parseFloat(c[2]),
      confidence: c[8] ?? '',
      source,
    }
  })

  return { count: points.length, points, source }
}

/**
 * Fetch fire/thermal event count for a bounding box.
 * Tries each source in SOURCE_PRIORITY order — returns the first success.
 *
 * @param {Object} bbox   - { minLon, minLat, maxLon, maxLat }
 * @param {number} days   - Days to look back (MAP_KEY max = 5)
 */
export async function fetchFireEvents(bbox, days = 2) {
  const key = import.meta.env.VITE_NASA_FIRMS_KEY
  if (!key) {
    console.warn('[FIRMS] No VITE_NASA_FIRMS_KEY — returning null (mock will be used).')
    return null
  }

  // MAP_KEY is capped at 5 days; full API keys support up to 10
  const safeDays = Math.min(Math.max(1, days), 5)
  const area     = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`

  for (const source of SOURCE_PRIORITY) {
    const result = await fetchFromSource(key, source, area, safeDays)
    if (result !== null) {
      if (result.count > 0) {
        console.debug(`[FIRMS] ${result.count} events from ${source}`)
      }
      return result
    }
    // null means this source failed — loop continues to next
  }

  // All sources failed
  console.error('[FIRMS] All sources returned errors. Check MAP_KEY validity and daily quota.')
  return null
}