
const BASE_URL = import.meta.env.DEV
  ? '/gbif'
  : 'https://api.gbif.org/v1'

const GBIF_REFERENCE_SPECIES = 400

export async function fetchSpeciesCount(bbox) {
  const currentYear = new Date().getFullYear()
  const fromYear    = currentYear - 2   // last 2 years only

  const params = new URLSearchParams({
    decimalLatitude:  `${bbox.minLat},${bbox.maxLat}`,
    decimalLongitude: `${bbox.minLon},${bbox.maxLon}`,
    facet:            'speciesKey',
    facetLimit:       '500',    // up from 200 — captures more species in rich areas
    limit:            '0',
    year:             `${fromYear},${currentYear}`,  // recent 2-year window
    occurrenceStatus: 'PRESENT',  // exclude absence records
  })

  let res
  try {
    res = await fetch(`${BASE_URL}/occurrence/search?${params}`)
  } catch (err) {
    console.error('[GBIF] Network error:', err.message)
    return null
  }

  if (!res.ok) {
    console.error('[GBIF] API error:', res.status)
    return null
  }

  const data = await res.json()

  // facetLimit=500 means we get up to 500 unique species keys
  // If the zone has >500 species, we hit the cap — note this as a flag
  const speciesCount    = data.facets?.[0]?.counts?.length ?? 0
  const occurrenceCount = data.count ?? 0
  const capped          = speciesCount >= 500

  // Normalize against reference (capped flag means real count is likely higher)
  const historicalScore = Math.min(100, Math.round(
    (speciesCount / GBIF_REFERENCE_SPECIES) * 100 * (capped ? 1.15 : 1.0)
  ))

  return {
    speciesCount,
    occurrenceCount,
    historicalScore,
    yearRange: `${fromYear}–${currentYear}`,
    capped,   // true = zone likely has more species than we can count via facets
  }
}