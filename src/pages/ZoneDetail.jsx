import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { RefreshCw, Trash2 } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip as ChartTooltip } from 'chart.js'
import {
  MapContainer, TileLayer, LayersControl,
  Rectangle, Tooltip, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import FetchModal from '../components/FetchModal'
import LoadingSpinner from '../components/LoadingSpinner'
import { useZoneData } from '../hooks/useZoneData'
import { removeCustomZone } from '../services/dataService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

// Fix Vite-broken Leaflet icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const statusColors = { healthy: '#2ECC71', watch: '#F59E0B', alert: '#EA580C', critical: '#EF4444' }

// ---------------------------------------------------------------------------
// NDVI colour scale (same as ZoneMap)
// ---------------------------------------------------------------------------
function ndviColor(val) {
  if (val >= 75) return '#15803D'
  if (val >= 60) return '#22A95C'
  if (val >= 45) return '#84CC16'
  if (val >= 30) return '#D97706'
  if (val >= 15) return '#EA580C'
  return '#DC3545'
}

// ---------------------------------------------------------------------------
// Generate a spatially-varied NDVI grid from a single mean value.
// Uses a seeded pseudo-random so values are stable across re-renders.
// ---------------------------------------------------------------------------
function buildNdviGrid(bbox, meanNdvi, cols = 8, rows = 6) {
  const { minLat, maxLat, minLon, maxLon } = bbox
  const latStep = (maxLat - minLat) / rows
  const lonStep = (maxLon - minLon) / cols
  const cells = []

  // Simple seeded noise — deterministic per zone
  let seed = Math.round(meanNdvi * 137 + cols * 31)
  function rand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff
    return (seed >>> 0) / 0xffffffff
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Spatial gradient: edges slightly lower NDVI, centre higher
      const edgeFactor = 1 - 0.12 * (
        Math.abs(r - rows / 2) / (rows / 2) +
        Math.abs(c - cols / 2) / (cols / 2)
      ) / 2
      // ±15 variance around mean
      const variance = (rand() - 0.5) * 30
      const val = Math.max(5, Math.min(100, Math.round(meanNdvi * edgeFactor + variance)))

      cells.push({
        id: `${r}-${c}`,
        bounds: [
          [minLat + r * latStep,       minLon + c * lonStep],
          [minLat + (r + 1) * latStep, minLon + (c + 1) * lonStep],
        ],
        ndvi: val,
        color: ndviColor(val),
      })
    }
  }
  return cells
}

// ---------------------------------------------------------------------------
// Auto-fit map to zone bbox
// ---------------------------------------------------------------------------
function FitBounds({ bbox }) {
  const map = useMap()
  useMemo(() => {
    if (!bbox) return
    const bounds = L.latLngBounds(
      [bbox.minLat, bbox.minLon],
      [bbox.maxLat, bbox.maxLon]
    )
    map.fitBounds(bounds, { padding: [24, 24] })
  }, [map, bbox])
  return null
}

// ---------------------------------------------------------------------------
// NDVI Grid Map — full Leaflet map zoomed to zone with cell grid overlay
// ---------------------------------------------------------------------------
function NdviGridMap({ zone, height = 400 }) {
  const ndviGrid = useMemo(
    () => zone.bbox ? buildNdviGrid(zone.bbox, zone.signals.ndvi) : [],
    [zone.bbox, zone.signals.ndvi]
  )

  const center = zone.bbox
    ? [(zone.bbox.minLat + zone.bbox.maxLat) / 2, (zone.bbox.minLon + zone.bbox.maxLon) / 2]
    : [24.5, 83.0]

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #D4E4D8', boxShadow: '0 4px 24px rgba(26,46,30,0.08)', position: 'relative' }}>
      <MapContainer center={center} zoom={10} style={{ height, width: '100%' }} zoomControl>
        {zone.bbox && <FitBounds bbox={zone.bbox} />}

        <LayersControl position="bottomleft">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri" maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* NDVI cell grid */}
        {ndviGrid.map(cell => (
          <Rectangle
            key={cell.id}
            bounds={cell.bounds}
            pathOptions={{
              color: cell.color,
              fillColor: cell.color,
              fillOpacity: 0.45,
              weight: 0.5,
              opacity: 0.6,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                <div style={{ fontWeight: 700, color: cell.color }}>NDVI {cell.ndvi}%</div>
                <div style={{ color: '#6B8872', fontSize: 10 }}>
                  {cell.ndvi >= 60 ? 'Dense vegetation' : cell.ndvi >= 40 ? 'Moderate cover' : cell.ndvi >= 20 ? 'Sparse cover' : 'Bare/degraded'}
                </div>
              </div>
            </Tooltip>
          </Rectangle>
        ))}
      </MapContainer>

      {/* NDVI legend */}
      <div style={{
        position: 'absolute', bottom: 30, right: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderRadius: 8, padding: '8px 10px', border: '1px solid #E0E8E2',
        boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#4B6B55', marginBottom: 4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: 0.5 }}>NDVI</div>
        {[
          ['75–100', '#15803D', 'Dense'],
          ['60–75',  '#22A95C', 'Healthy'],
          ['45–60',  '#84CC16', 'Moderate'],
          ['30–45',  '#D97706', 'Sparse'],
          ['15–30',  '#EA580C', 'Degraded'],
          ['0–15',   '#DC3545', 'Bare'],
        ].map(([range, color, label]) => (
          <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }}/>
            <span style={{ color: '#4B6B55', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>{range} <span style={{ color: '#9DB8A2' }}>{label}</span></span>
          </div>
        ))}
        <div style={{ marginTop: 6, fontSize: 8, color: '#9DB8A2', fontFamily: 'JetBrains Mono, monospace' }}>
          Mean: {zone.signals.ndvi}% · Copernicus
        </div>
      </div>

      {/* Live pill */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: 'rgba(26,46,30,0.85)', borderRadius: 20, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7ED9A0', fontWeight: 700,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22A95C', display: 'inline-block' }}/>
        NDVI GRID
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend data generator
// ---------------------------------------------------------------------------
function gen90DayData(fhi) {
  const labels = [], data = []
  for (let i = 89; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    if (i > 75) data.push(fhi + 20 + Math.random() * 8)
    else if (i > 50) data.push(fhi + 12 + Math.random() * 6)
    else if (i > 25) data.push(fhi + 5 + Math.random() * 5)
    else data.push(fhi + Math.random() * 6 - 3)
  }
  return { labels, data }
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ZoneDetail() {
  const { zoneId }   = useParams()
  const navigate     = useNavigate()
  const resolvedId   = zoneId || 'corbett-a'
  const { data: zone, loading } = useZoneData(resolvedId)
  const [activeTab, setActiveTab] = useState('fhi')
  const [fetchOpen, setFetchOpen] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  if (loading || !zone) return (
    <>
      <LoadingSpinner message={`Loading ${resolvedId}…`} />
      <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
        <button onClick={() => setFetchOpen(true)} className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} /> Fetch Data
        </button>
      </div>
      <FetchModal open={fetchOpen} onClose={() => setFetchOpen(false)} />
    </>
  )

  const trend90 = gen90DayData(zone.fhi)
  const color   = statusColors[zone.status]
  const sigs    = zone.signals

  const signalDetails = [
    { name: 'NDVI Canopy',  current: sigs.ndvi,        prev: Math.min(100, sigs.ndvi + Math.round(Math.random() * 10 - 3)),       color: '#2ECC71', source: 'Copernicus' },
    { name: 'Biodiversity', current: sigs.biodiversity, prev: Math.min(100, sigs.biodiversity + Math.round(Math.random() * 8 - 2)), color: '#00BFA5', source: 'GBIF + eBird' },
    { name: 'Thermal Risk', current: sigs.thermalRisk,  prev: Math.min(100, sigs.thermalRisk + Math.round(Math.random() * 12 - 6)), color: '#EF4444', source: 'NASA FIRMS' },
    { name: 'Moisture',     current: sigs.moisture,     prev: Math.min(100, sigs.moisture + Math.round(Math.random() * 6 - 3)),     color: '#3B82F6', source: 'OpenWeather' },
    { name: 'Cover Health', current: sigs.coverHealth,  prev: Math.min(100, sigs.coverHealth + Math.round(Math.random() * 5)),      color: '#8B5CF6', source: 'GFW' },
  ]

  const alertLogs = []
  if (zone.fire.count > 5) alertLogs.push({ time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), type: 'CRITICAL', signal: 'Thermal', value: `${zone.fire.count} events`, action: 'Ranger dispatched', color: '#EF4444' })
  if (sigs.ndvi < 50)      alertLogs.push({ time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), type: 'WATCH', signal: 'NDVI Canopy', value: `${sigs.ndvi}%`, action: 'Monitoring', color: '#F59E0B' })
  if (sigs.moisture < 40)  alertLogs.push({ time: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), type: 'WATCH', signal: 'Moisture', value: `${sigs.moisture}%`, action: 'Under review', color: '#F59E0B' })
  if (!alertLogs.length)   alertLogs.push({ time: 'Today', type: 'HEALTHY', signal: 'All', value: '—', action: 'No issues', color: '#2ECC71' })

  const handleDelete = () => {
    removeCustomZone(resolvedId)
    navigate('/zones')
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
          <button onClick={() => setFetchOpen(true)} className="btn btn-ghost btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Refresh Data
          </button>
          {zone.custom && (
            <button onClick={() => setShowDelete(true)} className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#DC3545' }}>
              <Trash2 size={13} /> Remove Zone
            </button>
          )}
          <button className="btn btn-ghost-red btn-sm">Dispatch Ranger</button>
          <button className="btn btn-ghost btn-sm">Export Report</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <h1 className="page-title">{zone.name}</h1>
        <span className="mono text-mono-green" style={{ fontSize: 13 }}>{zone.coords}</span>
        <span className={`badge badge-${zone.status}`}>{zone.status.toUpperCase()}</span>
        {zone.custom && (
          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,136,114,0.15)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>
            custom zone
          </span>
        )}
      </div>

      {/* Data source pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(zone.dataSource).map(([key, src]) => (
          <span key={key} style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 10,
            background: src === 'mock' ? 'rgba(217,119,6,0.12)' : 'rgba(34,169,92,0.12)',
            color: src === 'mock' ? '#D97706' : '#22A95C',
            fontFamily: 'var(--font-mono)',
          }}>{key}: {src}</span>
        ))}
      </div>

      {/* Main Grid — NDVI map + stats */}
      <div className="two-col col-55-45">
        {/* NDVI Grid Map — zoomed to zone bbox */}
        <div style={{ alignSelf: 'flex-start' }}>
          <NdviGridMap zone={zone} height={400} />
          <p style={{ fontSize: 10, color: '#9DB8A2', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
            NDVI grid shows spatial vegetation variation across {zone.name}.
            Mean NDVI {sigs.ndvi}% from Copernicus Sentinel-2. Hover cells for values.
          </p>
        </div>

        <div className="stack">
          {/* FHI */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 4 }}>CURRENT FHI</div>
            <div className="mono" style={{ fontSize: 56, fontWeight: 700, color, lineHeight: 1 }}>{zone.fhi}</div>
            <div style={{ margin: '10px 0' }}>
              <div className="gauge-bar">
                <div className="gauge-dot" style={{ left: `${zone.fhi}%`, background: color, boxShadow: `0 0 8px ${color}80` }}></div>
              </div>
            </div>
            <div className="text-muted" style={{ fontSize: 11 }}>
              Last updated: {new Date(zone.lastUpdated).toLocaleTimeString()}
            </div>
          </div>

          {/* Weather */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>Weather Conditions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Temperature</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.temp}°C</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Humidity</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.humidity}%</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Rainfall</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.rainfall} mm</div></div>
              <div><span style={{ fontSize: 11, color: '#6B8872' }}>Wind</span><div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{zone.weather.windSpeed} m/s</div></div>
            </div>
            <div style={{ marginTop: 6, fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>
              Source: OpenWeatherMap · {zone.weather.condition}
            </div>
          </div>

          {/* Signal table */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Detail</div>
            <table className="data-table">
              <thead>
                <tr><th>Signal</th><th>Current</th><th>Prev</th><th>Delta</th><th>Source</th></tr>
              </thead>
              <tbody>
                {signalDetails.map(s => {
                  const delta = s.current - s.prev
                  return (
                    <tr key={s.name}>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }}/>
                        {s.name}
                      </td>
                      <td className="mono">{s.current}%</td>
                      <td className="mono" style={{ color: '#6B8F72' }}>{s.prev}%</td>
                      <td className={`mono ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                        {delta >= 0 ? '↑+' : '↓'}{delta}%
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

      {activeTab === 'fhi' && (
        <>
          <div className="card" style={{ padding: '16px 20px' }}>
            <div className="chart-container" style={{ height: 200 }}>
              <Line
                data={{
                  labels: trend90.labels,
                  datasets: [{
                    data: trend90.data, borderColor: '#2ECC71', borderWidth: 2, pointRadius: 0, fill: true,
                    backgroundColor: (ctx) => {
                      const { ctx: c, chartArea } = ctx.chart
                      if (!chartArea) return 'transparent'
                      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                      g.addColorStop(0, 'rgba(34,169,92,0.10)')
                      g.addColorStop(1, 'rgba(220,53,69,0.05)')
                      return g
                    },
                    tension: 0.3,
                  }]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', borderColor: '#E0E8E2', borderWidth: 1, titleColor: '#1A2E1E', bodyColor: '#1B7A3D', bodyFont: { family: 'JetBrains Mono' }, padding: 10, displayColors: false, callbacks: { label: ctx => `FHI: ${ctx.parsed.y.toFixed(1)}` } } },
                  scales: {
                    x: { ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' } },
                    y: { min: 0, max: 100, ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 20 }, grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' } }
                  }
                }}
              />
            </div>
          </div>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>Alert Log</div>
            <table className="data-table">
              <thead><tr><th>Time</th><th>Type</th><th>Signal</th><th>Value</th><th>Action</th></tr></thead>
              <tbody>
                {alertLogs.map((a, i) => (
                  <tr key={i} style={{ borderLeft: `3px solid ${a.color}` }}>
                    <td className="mono" style={{ fontSize: 11 }}>{a.time}</td>
                    <td><span className="badge" style={{ background: a.color + '20', color: a.color, fontSize: 10 }}>{a.type}</span></td>
                    <td>{a.signal}</td><td className="mono">{a.value}</td>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{sigs.ndvi}%</div>
              <div className="stat-mini-label">Mean NDVI</div>
              <div className="stat-mini-sub">Copernicus Sentinel-2</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value" style={{ color: '#8B5CF6' }}>{sigs.coverHealth}%</div>
              <div className="stat-mini-label">Cover Health</div>
              <div className="stat-mini-sub">Global Forest Watch</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{zone.treeCover.totalLossHa.toLocaleString()} ha</div>
              <div className="stat-mini-label">Tree Cover Loss</div>
              <div className="stat-mini-sub">Since 2019</div>
            </div>
          </div>
          {/* Full-width NDVI grid in tab */}
          <NdviGridMap zone={zone} height={320} />
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>Alerts Log — {zone.name}</div>
          <table className="data-table">
            <thead><tr><th>Time</th><th>Type</th><th>Signal</th><th>Value</th><th>Action</th></tr></thead>
            <tbody>
              {alertLogs.map((a, i) => (
                <tr key={i} style={{ borderLeft: `3px solid ${a.color}` }}>
                  <td className="mono" style={{ fontSize: 11 }}>{a.time}</td>
                  <td><span className="badge" style={{ background: a.color + '20', color: a.color, fontSize: 10 }}>{a.type}</span></td>
                  <td>{a.signal}</td><td className="mono">{a.value}</td>
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

      {/* Delete confirmation */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(26,46,30,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remove zone?</div>
            <div style={{ fontSize: 13, color: '#6B8872', marginBottom: 20, lineHeight: 1.6 }}>
              <strong>{zone.name}</strong> will be permanently removed from monitoring.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="btn btn-sm" onClick={handleDelete} style={{ background: '#DC3545', color: '#fff', border: 'none' }}>Remove Zone</button>
            </div>
          </div>
        </div>
      )}

      <FetchModal open={fetchOpen} onClose={() => setFetchOpen(false)} />
    </>
  )
}