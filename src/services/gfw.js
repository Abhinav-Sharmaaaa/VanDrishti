/**
 * Copernicus Land Monitoring — Tree Cover / Land Cover Change
 * Uses the same Sentinel Hub credentials as ndvi.js
 *
 * Environment variables required (same as NDVI):
 *   VITE_COPERNICUS_CLIENT_ID
 *   VITE_COPERNICUS_CLIENT_SECRET
 *
 * Fetches Sentinel-2 based tree cover density and land cover change
 * using the Statistical API with a custom evalscript.
 */

// Vite proxy: /sentinel/* → https://services.sentinel-hub.com/*
const BASE_URL = import.meta.env.DEV
  ? '/sentinel'
  : 'https://services.sentinel-hub.com'

async function getCopernicusToken() {
  const clientId = import.meta.env.VITE_COPERNICUS_CLIENT_ID
  const clientSecret = import.meta.env.VITE_COPERNICUS_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  })
  const data = await res.json()
  return data.access_token
}

/**
 * Fetch tree cover density estimate using Sentinel-2 bands.
 * Uses a vegetation fraction proxy (NDVI > 0.4 = tree cover).
 *
 * @param {Object} bbox - { minLon, minLat, maxLon, maxLat }
 * @param {string} fromDate - ISO date e.g. '2024-01-01'
 * @param {string} toDate   - ISO date e.g. '2025-01-01'
 * @returns {Promise<{ treeCoverPct: number, coverLossPct: number, totalLossHa: number, yearlyLoss: Array }>}
 */
export async function fetchTreeCoverLoss(bbox, fromDate, toDate) {
  const token = await getCopernicusToken()
  if (!token) {
    console.warn('[TreeCover] No Copernicus credentials. Returning mock data.')
    return null
  }

  // Evalscript: compute fraction of pixels with NDVI > 0.4 (proxy for tree cover)
  // Statistical API requires plain-text evalscript — NOT base64 (btoa is only for Process API).
  // dataMask MUST be declared in setup() output or the API returns 400.
  const evalscript = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "tree_cover", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask",   bands: 1, sampleType: "UINT8"   }
    ]
  }
}
function evaluatePixel(s) {
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.000001)
  return { tree_cover: [ndvi > 0.4 ? 1 : 0], dataMask: [s.dataMask] }
}`

  const body = {
    input: {
      bounds: {
        bbox: [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: 'sentinel-2-l2a',
        dataFilter: {
          timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
          maxCloudCoverage: 30,
        },
      }],
    },
    aggregation: {
      timeRange: { from: `${fromDate}T00:00:00Z`, to: `${toDate}T23:59:59Z` },
      aggregationInterval: { of: 'P7D' }, // 7-day buckets fit within the 14-day window from dataService
      evalscript,
    },
    // No "calculations" block — API returns stats.mean by default
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/statistics`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      console.error('[TreeCover] Copernicus API error', res.status)
      return null
    }

    const json = await res.json()
    const intervals = json?.data || []

    if (!intervals.length) return null

    // Calculate tree cover percentage from the latest interval
    const latest = intervals[intervals.length - 1]
    const treeCoverPct = Math.round(
      (latest?.outputs?.tree_cover?.bands?.B0?.stats?.mean ?? 0.5) * 100
    )

    // Compare first vs last interval to estimate cover change
    const earliest = intervals[0]
    const earlyPct = Math.round(
      (earliest?.outputs?.tree_cover?.bands?.B0?.stats?.mean ?? 0.5) * 100
    )
    const lossPct = Math.max(0, earlyPct - treeCoverPct)

    // Estimate area loss in hectares (rough bbox area calculation)
    const latDiff = bbox.maxLat - bbox.minLat
    const lonDiff = bbox.maxLon - bbox.minLon
    const areaKm2 = latDiff * 111 * lonDiff * 111 * Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180)
    const areaHa = areaKm2 * 100
    const totalLossHa = Math.round(areaHa * (lossPct / 100))

    // coverLossPct = health score (100 = no loss = healthy, 0 = severe loss)
    const coverLossPct = Math.max(0, Math.min(100, 100 - lossPct * 5))

    return {
      treeCoverPct,
      totalLossHa,
      coverLossPct,
      yearlyLoss: intervals.map((d, i) => ({
        period: i + 1,
        coverPct: Math.round((d?.outputs?.tree_cover?.bands?.B0?.stats?.mean ?? 0) * 100),
      })),
    }
  } catch (err) {
    console.error('[TreeCover] Fetch error', err)
    return null
  }
}