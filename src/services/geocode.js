/**
 * Nominatim (OpenStreetMap) — Reverse Geocoding
 * API Docs: https://nominatim.org/release-docs/latest/api/Reverse/
 *
 * No API key required. Usage subject to OSM usage policy:
 *   https://operations.osmfoundation.org/policies/nominatim/
 *
 * Converts lat/lon coordinates to a human-readable place name.
 */

// Vite proxy: /nominatim/* → https://nominatim.openstreetmap.org/*
const BASE_URL = import.meta.env.DEV
  ? '/nominatim'
  : 'https://nominatim.openstreetmap.org'

/**
 * Reverse-geocode a lat/lon to a place name.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ display_name: string, village?: string, state?: string, country?: string }>}
 */
export async function reverseGeocode(lat, lon) {
  const params = new URLSearchParams({ lat, lon, format: 'json', zoom: 10 })
  const res = await fetch(`${BASE_URL}/reverse?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'VanDrishti/1.0' },
  })

  if (!res.ok) {
    console.error('[Geocode] Nominatim error', res.status)
    return null
  }

  const data = await res.json()
  return {
    display_name: data.display_name,
    village: data.address?.village || data.address?.town || data.address?.city,
    district: data.address?.county || data.address?.state_district,
    state: data.address?.state,
    country: data.address?.country,
  }
}

/**
 * Forward-geocode a place name to lat/lon.
 * @param {string} query
 * @returns {Promise<{ lat: number, lon: number, display_name: string }|null>}
 */
export async function geocode(query) {
  const params = new URLSearchParams({ q: query, format: 'json', limit: 1 })
  const res = await fetch(`${BASE_URL}/search?${params}`, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'VanDrishti/1.0' },
  })

  if (!res.ok) {
    console.error('[Geocode] Nominatim search error', res.status)
    return null
  }

  const data = await res.json()
  if (!data.length) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display_name: data[0].display_name }
}