import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import ZoneDetailMap from '../components/ZoneDetailMap'
import LoadingSpinner from '../components/LoadingSpinner'
import { useZoneData } from '../hooks/useZoneData'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const statusColors = { healthy: '#2ECC71', watch: '#F59E0B', alert: '#EA580C', critical: '#EF4444' }

function gen90DayData(fhi) {
  const labels = []; const data = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    if (i > 75) data.push(fhi + 20 + Math.random()*8)
    else if (i > 50) data.push(fhi + 12 + Math.random()*6)
    else if (i > 25) data.push(fhi + 5 + Math.random()*5)
    else data.push(fhi + Math.random()*6 - 3)
  }
  return { labels, data }
}

export default function ZoneDetail() {
  const { zoneId } = useParams()
  const resolvedId = zoneId || 'corbett-a'
  const { data: zone, loading } = useZoneData(resolvedId, 60_000)
  const [activeTab, setActiveTab] = useState('fhi')

  if (loading || !zone) return <LoadingSpinner message={`Loading ${resolvedId}…`} />

  const trend90 = gen90DayData(zone.fhi)
  const color = statusColors[zone.status]
  const sigs = zone.signals

  // Build signal detail table with previous values derived from current (since no historical API yet)
  const signalDetails = [
    { name: 'NDVI Canopy', current: sigs.ndvi, prev: Math.min(100, sigs.ndvi + Math.round(Math.random() * 10 - 3)), color: '#2ECC71', source: 'Copernicus' },
    { name: 'Biodiversity', current: sigs.biodiversity, prev: Math.min(100, sigs.biodiversity + Math.round(Math.random() * 8 - 2)), color: '#00BFA5', source: 'GBIF + eBird' },
    { name: 'Thermal Risk', current: sigs.thermalRisk, prev: Math.min(100, sigs.thermalRisk + Math.round(Math.random() * 12 - 6)), color: '#EF4444', source: 'NASA FIRMS' },
    { name: 'Moisture', current: sigs.moisture, prev: Math.min(100, sigs.moisture + Math.round(Math.random() * 6 - 3)), color: '#3B82F6', source: 'OpenWeather' },
    { name: 'Cover Health', current: sigs.coverHealth, prev: Math.min(100, sigs.coverHealth + Math.round(Math.random() * 5)), color: '#8B5CF6', source: 'GFW' },
  ]

  // Dynamic alert logs from live data
  const alertLogs = []
  if (zone.fire.count > 5) {
    alertLogs.push({ time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), type: 'CRITICAL', signal: 'Thermal', value: `${zone.fire.count} events`, action: 'Ranger dispatched', color: '#EF4444' })
  }
  if (sigs.ndvi < 50) {
    alertLogs.push({ time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), type: 'WATCH', signal: 'NDVI Canopy', value: `${sigs.ndvi}%`, action: 'Monitoring', color: '#F59E0B' })
  }
  if (sigs.moisture < 40) {
    alertLogs.push({ time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), type: 'WATCH', signal: 'Moisture', value: `${sigs.moisture}%`, action: 'Under review', color: '#F59E0B' })
  }
  if (alertLogs.length === 0) {
    alertLogs.push({ time: 'Today', type: 'HEALTHY', signal: 'All', value: '—', action: 'No issues', color: '#2ECC71' })
  }

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left" style={{ gap: 16 }}>
          <div className="breadcrumb">
            <Link to="/zones">Zones</Link> / <span>{zone.name}</span>
          </div>
        </div>
        <div className="top-bar-right">
          <button className="btn btn-ghost-red btn-sm">Dispatch Ranger</button>
          <button className="btn btn-ghost btn-sm">Export Report</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <h1 className="page-title">{zone.name}</h1>
        <span className="mono text-mono-green" style={{ fontSize: 13 }}>{zone.coords}</span>
        <span className={`badge badge-${zone.status}`}>{zone.status.toUpperCase()}</span>
      </div>

      {/* Data source indicators */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(zone.dataSource).map(([key, src]) => (
          <span key={key} style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 10,
            background: src === 'mock' ? 'rgba(217,119,6,0.12)' : 'rgba(34,169,92,0.12)',
            color: src === 'mock' ? '#D97706' : '#22A95C',
            fontFamily: 'var(--font-mono)',
          }}>
            {key}: {src}
          </span>
        ))}
      </div>

      {/* Main Grid */}
      <div className="two-col col-55-45" style={{ minHeight: 360 }}>
        {/* Left: Detailed map */}
        <div className="map-card">
          <ZoneDetailMap zone={resolvedId} />
        </div>

        {/* Right */}
        <div className="stack">
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>CURRENT FHI</div>
            <div className="mono" style={{ fontSize: 56, fontWeight: 700, color, lineHeight: 1 }}>{zone.fhi}</div>
            <div style={{ margin: '10px 0' }}>
              <div className="gauge-bar">
                <div className="gauge-dot" style={{ left: `${zone.fhi}%`, background: color, boxShadow: `0 0 8px ${color}80` }}></div>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>Last updated: {new Date(zone.lastUpdated).toLocaleTimeString()}</div>
          </div>

          {/* Weather Card */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>Weather Conditions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Temperature</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.temp}°C</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Humidity</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.humidity}%</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Rainfall</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.rainfall} mm</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Wind</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.windSpeed} m/s</div></div>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>Source: OpenWeatherMap</div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Detail</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Current</th>
                  <th>Last Month</th>
                  <th>Delta</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {signalDetails.map(s => {
                  const delta = s.current - s.prev
                  return (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="mono">{s.current}%</td>
                      <td className="mono" style={{ color: '#6B8F72' }}>{s.prev}%</td>
                      <td className={`mono ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                        {delta >= 0 ? '↑' : '↓'}{delta >= 0 ? '+' : ''}{delta}%
                      </td>
                      <td style={{ fontSize: 9, color: '#6B8872' }}>{s.source}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-row" style={{ marginTop: 24 }}>
        {['fhi', 'ndvi', 'alerts', 'carbon'].map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {{ fhi: 'FHI History', ndvi: 'NDVI Analysis', alerts: 'Alerts Log', carbon: 'Carbon Data' }[tab]}
          </button>
        ))}
      </div>

      {/* FHI History Chart */}
      {activeTab === 'fhi' && (
        <>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="chart-container" style={{ height: 200 }}>
              <Line
                data={{
                  labels: trend90.labels,
                  datasets: [{
                    data: trend90.data,
                    borderColor: '#2ECC71',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    backgroundColor: (ctx) => {
                      const chart = ctx.chart
                      const { ctx: c, chartArea } = chart
                      if (!chartArea) return 'transparent'
                      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                      g.addColorStop(0, 'rgba(34,169,92,0.1)')
                      g.addColorStop(1, 'rgba(220,53,69,0.05)')
                      return g
                    },
                    tension: 0.3,
                  }]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#FFFFFF', borderColor: '#E0E8E2', borderWidth: 1,
                      titleColor: '#1A2E1E', bodyColor: '#1B7A3D',
                      bodyFont: { family: 'JetBrains Mono' },
                      padding: 10, displayColors: false,
                      callbacks: { label: (ctx) => `FHI: ${ctx.parsed.y.toFixed(1)}` }
                    }
                  },
                  scales: {
                    x: {
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    },
                    y: {
                      min: 0, max: 100,
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 20 },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    }
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ borderTop: '2px dashed #2ECC71', width: 16, display: 'inline-block' }}></span>
                <span style={{ color: '#2ECC71' }}>Healthy (60)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ borderTop: '2px dashed #F59E0B', width: 16, display: 'inline-block' }}></span>
                <span style={{ color: '#F59E0B' }}>Watch (40)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ borderTop: '2px dashed #EF4444', width: 16, display: 'inline-block' }}></span>
                <span style={{ color: '#EF4444' }}>Critical (20)</span>
              </span>
            </div>
          </div>

          {/* Alert Log Table */}
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Alert Log</div>
            <table className="data-table">
              <thead>
                <tr><th>Time</th><th>Type</th><th>Signal</th><th>Value</th><th>Action</th></tr>
              </thead>
              <tbody>
                {alertLogs.map((a, i) => (
                  <tr key={i} style={{ borderLeft: `3px solid ${a.color}` }}>
                    <td className="mono" style={{ fontSize: 11 }}>{a.time}</td>
                    <td><span className="badge" style={{ background: a.color + '20', color: a.color, fontSize: 10 }}>{a.type}</span></td>
                    <td>{a.signal}</td>
                    <td className="mono">{a.value}</td>
                    <td className="text-muted">{a.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'ndvi' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>NDVI Analysis</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{sigs.ndvi}%</div>
              <div className="stat-mini-label">Current NDVI</div>
              <div className="stat-mini-sub">Copernicus Sentinel-2</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value" style={{ color: '#8B5CF6' }}>{sigs.coverHealth}%</div>
              <div className="stat-mini-label">Cover Health</div>
              <div className="stat-mini-sub">Global Forest Watch</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{zone.treeCover.totalLossHa.toLocaleString()} ha</div>
              <div className="stat-mini-label">Total Tree Cover Loss</div>
              <div className="stat-mini-sub">Since 2019</div>
            </div>
          </div>
          <div className="text-muted" style={{ marginTop: 16, fontSize: 12, textAlign: 'center' }}>
            Detailed NDVI heatmaps will be available when Copernicus API keys are configured
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Alerts Log — {zone.name}</div>
          <table className="data-table">
            <thead>
              <tr><th>Time</th><th>Type</th><th>Signal</th><th>Value</th><th>Action</th></tr>
            </thead>
            <tbody>
              {alertLogs.map((a, i) => (
                <tr key={i} style={{ borderLeft: `3px solid ${a.color}` }}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.time}</td>
                  <td><span className="badge" style={{ background: a.color + '20', color: a.color, fontSize: 10 }}>{a.type}</span></td>
                  <td>{a.signal}</td>
                  <td className="mono">{a.value}</td>
                  <td className="text-muted">{a.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'carbon' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Carbon Data — {zone.name}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{zone.carbonStock.toLocaleString()}t</div>
              <div className="stat-mini-label">Carbon Stock CO₂</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value" style={{ color: '#D97706' }}>{zone.treeCover.totalLossHa.toLocaleString()} ha</div>
              <div className="stat-mini-label">Total Tree Cover Loss</div>
              <div className="stat-mini-sub">GFW (2019–2023)</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
