const BASE_URL = '/api/sentinel'

export async function fetchNDVI(bbox, fromDate, toDate) {
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
        bbox: [bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat],
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{
        type: 'sentinel-2-l2a',
        dataFilter: {
          timeRange: { from: fromDate + 'T00:00:00Z', to: toDate + 'T23:59:59Z' },
          maxCloudCoverage: 80,
        },
      }],
    },
    aggregation: {
      timeRange: { from: fromDate + 'T00:00:00Z', to: toDate + 'T23:59:59Z' },
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

    for (let i = intervals.length - 1; i >= 0; i--) {
      const mean = intervals[i]?.outputs?.ndvi?.bands?.B0?.stats?.mean
      if (mean != null && !isNaN(mean)) {
        return Math.round(((mean + 1) / 2) * 100)
      }
    }
  } catch (err) {
    return null
  }

  return null
}