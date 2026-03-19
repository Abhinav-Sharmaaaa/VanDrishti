/**
 * GBIF — Global Biodiversity Information Facility
 * API Docs: https://www.gbif.org/developer/occurrence
 *
 * No API key required for read-only occurrence queries.
 *
 * Returns species count in a given geographic area.
 */

// Vite proxy: /gbif/* → https://api.gbif.org/v1/*
const BASE_URL = import.meta.env.DEV
  ? '/gbif'
  : 'https://api.gbif.org/v1'

/**
 * Fetch species richness (unique species count) in a bounding box.
 * @param {Object} bbox - { minLon, minLat, maxLon, maxLat }
 * @param {number} year  - Optional filter year
 * @returns {Promise<{ speciesCount: number, occurrenceCount: number }>}
 */
export async function fetchSpeciesCount(bbox, year = null) {
  const params = new URLSearchParams({
    decimalLatitude: `${bbox.minLat},${bbox.maxLat}`,
    decimalLongitude: `${bbox.minLon},${bbox.maxLon}`,
    facet: 'speciesKey',
    facetLimit: '200',   // must be > 0 — GBIF returns 400 if set to 0
    limit: '0',
  })
  if (year) params.set('year', year)

  const res = await fetch(`${BASE_URL}/occurrence/search?${params}`)
  if (!res.ok) {
    console.error('[GBIF] API error', res.status)
    return null
  }

  const data = await res.json()
  const speciesCount = data.facets?.[0]?.counts?.length ?? 0
  const occurrenceCount = data.count ?? 0

  return { speciesCount, occurrenceCount }
}