export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const clientId = process.env.SENTINEL_CLIENT_ID
  const clientSecret = process.env.SENTINEL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Sentinel Hub credentials not configured' })
  }

  try {
    const tokenRes = await fetch('https://services.sentinel-hub.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
    })

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text()
      return res.status(tokenRes.status).json({ error: 'Failed to fetch token', details: errorText })
    }

    const { access_token } = await tokenRes.json()

    const sentinelRes = await fetch('https://services.sentinel-hub.com/api/v1/statistics', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(req.body),
    })

    if (!sentinelRes.ok) {
      const errorText = await sentinelRes.text()
      return res.status(sentinelRes.status).json({ error: 'Sentinel Hub API error', details: errorText })
    }

    const data = await sentinelRes.json()
    return res.status(200).json(data)
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}
