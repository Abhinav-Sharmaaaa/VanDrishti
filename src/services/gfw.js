const BASE_URL = '/api/sentinel'

export async function fetchTreeCoverLoss(bbox, fromDate, toDate) {
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
      aggregationInterval: { of: 'P7D' },
      evalscript,
    },
  }

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) return null

    const json = await res.json()
    const intervals = json?.data || []

    if (!intervals.length) return null

    const latest = intervals[intervals.length - 1]
    const treeCoverPct = Math.round(
      (latest?.outputs?.tree_cover?.bands?.B0?.stats?.mean ?? 0.5) * 100
    )

    const earliest = intervals[0]
    const earlyPct = Math.round(
      (earliest?.outputs?.tree_cover?.bands?.B0?.stats?.mean ?? 0.5) * 100
    )
    const lossPct = Math.max(0, earlyPct - treeCoverPct)

    const latDiff = bbox.maxLat - bbox.minLat
    const lonDiff = bbox.maxLon - bbox.minLon
    const areaKm2 = latDiff * 111 * lonDiff * 111 * Math.cos((bbox.minLat + bbox.maxLat) / 2 * Math.PI / 180)
    const areaHa = areaKm2 * 100
    const totalLossHa = Math.round(areaHa * (lossPct / 100))

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
    return null
  }
}