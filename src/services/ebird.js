/**
 * eBird API 2.0 — Bird observation data (Cornell Lab of Ornithology)
 * API Docs: https://documenter.getpostman.com/view/664302/S1ENwy59
 *
 * Environment variables required:
 *   VITE_EBIRD_API_KEY
 *
 * Role in biodiversity stack: REAL-TIME signal (last 7 days)
 * Weight in final score: 50%
 *
 * Normalization: South Asian tropical forests (Corbett, Sundarbans) have
 * 300–600 recorded species. Using 300 as the baseline for 100% score gives
 * realistic scores without saturating at small counts.
 */

const BASE_URL = 'https://api.ebird.org/v2'

// South Asian reference richness — tropical moist forest benchmark
// Corbett NP: ~600 recorded, realistic 7-day survey: 80–150 species
// Sundarbans: ~300 recorded, realistic 7-day survey: 40–80 species
// Using 150 as the "excellent" baseline for 7-day point surveys
const EBIRD_REFERENCE_SPECIES = 150

/**
 * Fetch recent bird observations near a lat/lon.
 * Returns a normalized score (0–100) weighted toward recent detections.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusKm - Search radius (max 50 km)
 * @param {number} back     - Days back (7 = recent, matches our update cycle)
 */
export async function fetchBirdActivity(lat, lon, radiusKm = 25, back = 7) {
  const key = import.meta.env.VITE_EBIRD_API_KEY
  if (!key) {
    console.warn('[eBird] No API key — returning null (mock will be used).')
    return null
  }

  const params = new URLSearchParams({
    lat, lng: lon,
    dist: radiusKm,
    back,
    maxResults: 500,   // increased from 200 to reduce truncation in species-rich zones
  })

  let res
  try {
    res = await fetch(`${BASE_URL}/data/obs/geo/recent?${params}`, {
      headers: { 'X-eBirdApiToken': key },
    })
  } catch (err) {
    console.error('[eBird] Network error:', err.message)
    return null
  }

  if (!res.ok) {
    console.error('[eBird] API error:', res.status)
    return null
  }

  const observations = await res.json()

  // Unique species from last `back` days
  const speciesSet   = new Set(observations.map(o => o.speciesCode))
  const speciesCount = speciesSet.size
  const obsvCount    = observations.length

  // Observation density — more observations in short window = healthier monitoring
  // Capped at 1.0 to avoid inflating score when area is near a birding hotspot
  const densityFactor = Math.min(1.0, obsvCount / 100)

  // Base score from species richness (primary signal)
  const richnessScore = Math.min(100, Math.round((speciesCount / EBIRD_REFERENCE_SPECIES) * 100))

  // Boost slightly if observation density is high (active birding = habitat accessible)
  // Penalty if density is very low (area may be inaccessible → spatial bias applies)
  const densityAdjusted = Math.round(richnessScore * (0.85 + 0.15 * densityFactor))

  return {
    observationCount: obsvCount,
    speciesCount,
    score: Math.min(100, densityAdjusted),
    // Expose raw richness score separately so dataService can use it in the formula
    richnessScore,
    // Flag if observations are very low — signals spatial bias (dense forest, no access)
    spatialBiasFlag: obsvCount < 10,
  }
}