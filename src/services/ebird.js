/**
 * eBird API 2.0 — Bird observation data (Cornell Lab of Ornithology)
 * API Docs: https://documenter.getpostman.com/view/664302/S1ENwy59
 *
 * Environment variables required:
 *   VITE_EBIRD_API_KEY
 *
 * Returns recent bird observation count as a biodiversity indicator.
 */

const BASE_URL = 'https://api.ebird.org/v2'

/**
 * Fetch recent notable bird observations near a lat/lon.
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm - Search radius in km (max 50)
 * @param {number} back     - Number of days back (max 30)
 * @returns {Promise<{ observationCount: number, speciesCount: number, hotspots: Array }>}
 */
export async function fetchBirdActivity(lat, lon, radiusKm = 25, back = 7) {
  const key = import.meta.env.VITE_EBIRD_API_KEY
  if (!key) {
    console.warn('[eBird] No API key. Returning mock data.')
    return null
  }

  const params = new URLSearchParams({ lat, lng: lon, dist: radiusKm, back, maxResults: 200 })
  const res = await fetch(`${BASE_URL}/data/obs/geo/recent?${params}`, {
    headers: { 'X-eBirdApiToken': key },
  })

  if (!res.ok) {
    console.error('[eBird] API error', res.status)
    return null
  }

  const observations = await res.json()
  const speciesSet = new Set(observations.map(o => o.speciesCode))

  return {
    observationCount: observations.length,
    speciesCount: speciesSet.size,
    // Normalized score 0–100 based on species richness (typical tropical richness ~300 spp)
    score: Math.min(100, Math.round((speciesSet.size / 120) * 100)),
  }
}