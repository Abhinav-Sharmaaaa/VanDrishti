/**
 * Copernicus Sentinel Hub / ESA — NDVI (Normalized Difference Vegetation Index)
 * API Docs: https://docs.sentinel-hub.com/api/latest/reference/#operation/getStatistics
 *
 * Environment variables required:
 *   VITE_COPERNICUS_CLIENT_ID
 *   VITE_COPERNICUS_CLIENT_SECRET
 *
 * IMPORTANT: The Statistical API takes evalscript as PLAIN TEXT, not base64.
 * Base64 encoding is only used by the Process API (/api/v1/process).
 */

// Vite proxy: /sentinel/* → https://services.sentinel-hub.com/*
const BASE_URL = import.meta.env.DEV
  ? '/sentinel'
  : 'https://services.sentinel-hub.com'

async function getCopernicusToken() {
  const clientId     = import.meta.env.VITE_COPERNICUS_CLIENT_ID
  const clientSecret = import.meta.env.VITE_COPERNICUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  })
  if (!res.ok) {
    console.error('[NDVI] Token error', res.status, await res.text().catch(() => ''))
    return null
  }
  const data = await res.json()
  return data.access_token ?? null
}

/**
 * Fetch mean NDVI for a bounding box using the Statistical API.
 * @param {Object} bbox     - { minLon, minLat, maxLon, maxLat }
 * @param {string} fromDate - ISO date e.g. '2025-01-01'
 * @param {string} toDate   - ISO date e.g. '2025-01-31'
 * @returns {Promise<number|null>} NDVI scaled to 0–100
 */
export async function fetchNDVI(bbox, fromDate, toDate) {
  const token = await getCopernicusToken()
  if (!token) {
    console.warn('[NDVI] No token — returning mock data.')
    return null
  }

  // Statistical API requires plain-text evalscript (NOT base64).
  // Base64 encoding is only for the Process API (/api/v1/process).
  const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi",     bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8"   }
    ]
  };
}
function evaluatePixel(s) {
  var ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.000001);
  if (ndvi < -1) ndvi = -1;
  if (ndvi > 1)  ndvi = 1;
  return { ndvi: [ndvi], dataMask: [1] };
}`

  const body = {
    input: {
      bounds: {
        bbox:       [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type:       'sentinel-2-l2a',   // must be lowercase
        dataFilter: {
          timeRange:        { from: fromDate + 'T00:00:00Z', to: toDate + 'T23:59:59Z' },
          maxCloudCoverage: 80,
        },
      }],
    },
    aggregation: {
      timeRange:           { from: fromDate + 'T00:00:00Z', to: toDate + 'T23:59:59Z' },
      aggregationInterval: { of: 'P7D' },   // weekly — avoids empty slots from cloud cover
      evalscript,                            // plain text — Statistical API decodes this itself
    },
    // No "calculations" block — API returns stats.mean by default
  }

  const res = await fetch(`${BASE_URL}/api/v1/statistics`, {
    method:  'POST',
    headers: {
      Authorization:  'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept:         'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text().catch(() => '(unreadable)')
    console.error('[NDVI] Statistics API error', res.status, errBody)
    return null
  }

  const json      = await res.json()
  const intervals = (json && json.data) ? json.data : []

  // Walk backwards — find the most recent interval with valid data
  for (let i = intervals.length - 1; i >= 0; i--) {
    const mean = intervals[i]?.outputs?.ndvi?.bands?.B0?.stats?.mean
    if (mean != null && !isNaN(mean)) {
      return Math.round(((mean + 1) / 2) * 100)   // scale [-1, 1] → [0, 100]
    }
  }

  console.warn('[NDVI] No valid intervals in response:', JSON.stringify(json).slice(0, 300))
  return null
}