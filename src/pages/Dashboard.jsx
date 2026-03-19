import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, User, Plus, RefreshCw, AlertTriangle, Trash2 } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip as ChartTooltip } from 'chart.js'
import ZoneMap from '../components/ZoneMap'
import FetchModal from '../components/FetchModal'
import AnimatedCounter from '../components/AnimatedCounter'
import LoadingSpinner from '../components/LoadingSpinner'
import { useZoneData, useAllZones, useCacheStatus, notifyCacheUpdated } from '../hooks/useZoneData'
import { ZONES, removeCustomZone } from '../services/dataService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const statusColors = { healthy: '#22A95C', watch: '#D97706', alert: '#C95C0C', critical: '#DC3545' }

function generateTrendData(fhi) {
  const labels = [], data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    if (i > 20) data.push(fhi + 20 + Math.random() * 8)
    else if (i > 10) data.push(fhi + 10 + Math.random() * 6)
    else if (i > 5) data.push(fhi + 5 + Math.random() * 5)
    else data.push(fhi + Math.random() * 5 - 2)
  }
  return { labels, data }
}

function getDelta(signals) {
  const ndvi = signals?.ndvi ?? 50
  if (ndvi >= 70) return { text: '↑ Strong canopy health', dir: 'up' }
  if (ndvi >= 50) return { text: '→ Moderate canopy', dir: 'flat' }
  return { text: '↓ Declining canopy trend', dir: 'down' }
}

function getLabel(status, fhi) {
  if (status === 'healthy') return `HEALTHY — Stable (FHI ${fhi})`
  if (status === 'watch')   return `WATCH — Declining trend (FHI ${fhi})`
  if (status === 'alert')   return `ALERT — Needs attention (FHI ${fhi})`
  return `CRITICAL — Immediate action (FHI ${fhi})`
}

const MAP_HEIGHT = 440

export default function Dashboard() {
  const navigate = useNavigate()
  const firstZoneId = Object.keys(ZONES)[0] ?? 'corbett-a'
  const [activeZone, setActiveZone] = useState(firstZoneId)
  const [fetchOpen, setFetchOpen]   = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { data: zone, loading }     = useZoneData(activeZone)
  const { zones: allZonesMap, refresh } = useAllZones()
  const { stale, ageMin, meta }     = useCacheStatus()
  const allZones = Object.values(allZonesMap)

  const handleRemoveZone = (id) => {
    removeCustomZone(id)
    notifyCacheUpdated()
    if (activeZone === id) {
      const remaining = Object.keys(ZONES).filter(k => k !== id)
      setActiveZone(remaining[0] ?? firstZoneId)
    }
    setDeleteTarget(null)
  }

  // Auto-open fetch modal on devices with no cache
  useEffect(() => {
    if (!loading && !zone) setFetchOpen(true)
  }, [loading, zone])

  if (loading || !zone) return (
    <>
      <LoadingSpinner message="Loading dashboard…" />
      <FetchModal open={fetchOpen} onClose={() => setFetchOpen(false)} />
    </>
  )

  const color = statusColors[zone.status]
  const trend = generateTrendData(zone.fhi)
  const delta = getDelta(zone.signals)
  const sigs  = zone.signals
  const activeAlerts = allZones.filter(z => z.status === 'critical' || z.status === 'alert' || z.fire?.count > 5).length

  return (
    <>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="breadcrumb"><span>Dashboard</span></div>
        </div>

        <div className="top-bar-center">
          <div className="zone-tabs">
            {Object.entries(ZONES).map(([id, z]) => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <button
                  className={`zone-tab ${activeZone === id ? 'active' : ''} ${activeZone === id && zone.status === 'healthy' ? 'healthy' : ''}`}
                  onClick={() => setActiveZone(id)}
                >
                  {z.name}
                </button>
                {/* Remove button — all zones */}
                <button
                    onClick={() => setDeleteTarget(id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#DC3545', padding: '2px 4px', display: 'flex', alignItems: 'center',
                      opacity: 0.6, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                    title={`Remove ${z.name}`}
                  >
                    <Trash2 size={11} />
                  </button>
              </div>
            ))}
            {/* Add Zone — navigates to zones page */}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/zones')}
            >
              <Plus size={14} />Add Zone
            </button>
          </div>
        </div>

        <div className="top-bar-right">
          {meta && (
            <button onClick={() => setFetchOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              borderRadius: 8, fontSize: 11, cursor: 'pointer',
              border: stale ? '1.5px solid #D97706' : '1px solid #D4E4D8',
              background: stale ? 'rgba(217,119,6,0.08)' : '#F8FBF9',
              color: stale ? '#B45309' : '#6B8872',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              {stale ? <AlertTriangle size={12} /> : <RefreshCw size={12} />}
              {stale ? `Stale · ${ageMin}m ago` : ageMin != null ? (ageMin < 1 ? 'just now' : `${ageMin}m ago`) : 'cached'}
            </button>
          )}
          <button onClick={() => setFetchOpen(true)} className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /> Fetch Now
          </button>
          <span className="sat-info">Updated {new Date(zone.lastUpdated).toLocaleTimeString()}</span>

          {/* Bell — navigates to alerts page */}
          <button
            onClick={() => navigate('/alerts')}
            className="notif-bell"
            style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}
          >
            <Bell size={18} />
            {activeAlerts > 0 && (
              <span className="bell-badge" style={{
                position: 'absolute', top: -4, right: -4,
                background: '#DC3545', color: '#fff',
                fontSize: 9, fontWeight: 700,
                width: 16, height: 16, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{activeAlerts}</span>
            )}
          </button>

          <div className="user-avatar"><User size={16} /></div>
        </div>
      </div>

      {/* Data source pills */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 0 8px', flexWrap: 'wrap' }}>
        {Object.entries(zone.dataSource).map(([key, src]) => (
          <span key={key} style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 10,
            background: src === 'mock' ? 'rgba(217,119,6,0.12)' : 'rgba(34,169,92,0.12)',
            color: src === 'mock' ? '#D97706' : '#22A95C',
            fontFamily: 'var(--font-mono)',
          }}>{key}: {src}</span>
        ))}
      </div>

      {/* Stale banner */}
      {stale && (
        <div style={{
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#B45309' }}>
            <AlertTriangle size={14} /> Data is {ageMin} minutes old — refresh for latest readings.
          </div>
          <button onClick={() => setFetchOpen(true)} style={{
            fontSize: 11, fontWeight: 600, color: '#B45309', background: 'none',
            border: '1px solid #D97706', borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          }}>Refresh</button>
        </div>
      )}

      {/* Main Grid */}
      <div className="two-col col-60-40">
        <div style={{ height: MAP_HEIGHT, alignSelf: 'flex-start' }}>
          <ZoneMap
            zones={allZones}
            selectedZoneId={activeZone}
            onZoneClick={id => { if (ZONES[id]) setActiveZone(id) }}
            showDraw={false}
            showSearch={false}
            defaultColorMode="ndvi"
            height={MAP_HEIGHT}
          />
        </div>

        <div className="stack" key={activeZone}>
          <div className="card">
            <div className="card-title">FOREST HEALTH INDEX</div>
            <div className="mono text-mono-green" style={{ fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
              {zone.name.toUpperCase()}
            </div>
            <div className="mono" style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, color }}>
              <AnimatedCounter value={zone.fhi} duration={1000} />
            </div>
            <div style={{ margin: '12px 0' }}>
              <div className="gauge-bar">
                <div className={`gauge-dot ${zone.status}`} style={{ left: `${zone.fhi}%` }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`badge badge-${zone.status}`}>{getLabel(zone.status, zone.fhi)}</span>
              <span className={delta.dir === 'down' ? 'text-red' : 'text-green'} style={{ fontSize: 12 }}>
                {delta.text}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Contributors</div>
            {[
              { label: 'NDVI Canopy',  val: sigs.ndvi,        color: '#22A95C', source: 'Copernicus' },
              { label: 'Biodiversity', val: sigs.biodiversity, color: '#0EA58C', source: 'GBIF + eBird' },
              { label: 'Thermal Risk', val: sigs.thermalRisk,  color: '#DC3545', source: 'NASA FIRMS' },
              { label: 'Moisture',     val: sigs.moisture,     color: '#3B82F6', source: 'OpenWeather' },
              { label: 'Cover Health', val: sigs.coverHealth,  color: '#8B5CF6', source: 'GFW' },
            ].map(s => (
              <div className="progress-row" key={s.label}>
                <span className="progress-label">
                  {s.label}
                  <span style={{ fontSize: 8, color: '#6B8872', marginLeft: 4 }}>({s.source})</span>
                </span>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${s.val}%`, background: s.color }}></div>
                </div>
                <span className="progress-value">{s.val}%</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">30-Day Trend</div>
              <span className="text-muted" style={{ fontSize: 11 }}>
                {new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} —{' '}
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <div className="chart-container" style={{ height: 140 }}>
              <Line
                data={{
                  labels: trend.labels,
                  datasets: [{
                    data: trend.data, borderColor: '#22A95C', borderWidth: 2, pointRadius: 0, fill: true,
                    backgroundColor: (ctx) => {
                      const { ctx: c, chartArea } = ctx.chart
                      if (!chartArea) return 'transparent'
                      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                      g.addColorStop(0, 'rgba(34,169,92,0.12)')
                      g.addColorStop(1, 'rgba(220,53,69,0.08)')
                      return g
                    },
                    tension: 0.35,
                  }]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: { backgroundColor: '#fff', borderColor: '#E0E8E2', borderWidth: 1, titleColor: '#1A2E1E', bodyColor: '#1B7A3D', bodyFont: { family: 'JetBrains Mono' }, padding: 10, displayColors: false, callbacks: { label: ctx => `FHI: ${ctx.parsed.y.toFixed(1)}` } }
                  },
                  scales: {
                    x: { ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 }, grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' } },
                    y: { min: 0, max: 100, ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 25 }, grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' } }
                  },
                  interaction: { intersect: false, mode: 'index' },
                }}
              />
            </div>
          </div>

          <div className="quick-stats">
            <div className="stat-mini-card">
              <div className="stat-mini-value text-amber"><AnimatedCounter value={zone.fire.count} /></div>
              <div className="stat-mini-label">Thermal Events</div>
              <div className="stat-mini-sub">NASA FIRMS</div>
              <div className="stat-mini-delta text-amber">{zone.fire.count > 4 ? '↑ HIGH' : '↓ LOW'}</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{zone.carbonStock.toLocaleString()}t</div>
              <div className="stat-mini-label">Carbon Stock CO₂</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value" style={{ color: '#0EA58C' }}>{zone.species.count}</div>
              <div className="stat-mini-label">Species Detected</div>
              <div className="stat-mini-sub">GBIF + eBird</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-blue">{zone.weather.temp}°C</div>
              <div className="stat-mini-label">{zone.weather.condition}</div>
              <div className="stat-mini-sub">Humidity: {zone.weather.humidity}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Ticker */}
      <div className="alert-ticker">
        {zone.fire.count > 5 && (
          <div className="alert-tick-card critical">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-red"><span className="severity-dot bg-red" />CRITICAL — {zone.name}</div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — {zone.fire.count} thermal anomalies detected</div>
            <button className="btn btn-ghost-red btn-sm" onClick={() => navigate('/alerts')}>VIEW ALERTS</button>
          </div>
        )}
        {zone.status === 'watch' && (
          <div className="alert-tick-card watch">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-amber"><span className="severity-dot bg-amber" />WATCH — {zone.name}</div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — Bio: {sigs.biodiversity}%, Moisture: {sigs.moisture}%</div>
            <button className="btn btn-ghost-amber btn-sm" onClick={() => navigate('/alerts')}>VIEW DETAILS</button>
          </div>
        )}
        {zone.status === 'healthy' && (
          <div className="alert-tick-card healthy">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-green"><span className="severity-dot bg-green" />HEALTHY — {zone.name}</div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — All signals stable</div>
          </div>
        )}
      </div>

      {/* Delete zone modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(26,46,30,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Remove zone?</div>
            <div style={{ fontSize: 13, color: '#6B8872', marginBottom: 20, lineHeight: 1.6 }}>
              <strong>{ZONES[deleteTarget]?.name}</strong> will be removed from monitoring.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={() => handleRemoveZone(deleteTarget)}
                style={{ background: '#DC3545', color: '#fff', border: 'none' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <FetchModal open={fetchOpen} onClose={() => setFetchOpen(false)} />
    </>
  )
}