import { useState } from 'react'
import { Bell, User, Plus } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import ZoneMap from '../components/ZoneMap'
import AnimatedCounter from '../components/AnimatedCounter'
import LoadingSpinner from '../components/LoadingSpinner'
import { useZoneData, useAllZones } from '../hooks/useZoneData'
import { ZONES } from '../services/dataService'

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

export default function Dashboard() {
  const [activeZone, setActiveZone] = useState('corbett-a')
  const { data: zone, loading }     = useZoneData(activeZone, 60_000)
  const { zones: allZonesMap }      = useAllZones(60_000)  // for the map overlay

  if (loading || !zone) return <LoadingSpinner message="Loading dashboard…" />

  const color    = statusColors[zone.status]
  const trend    = generateTrendData(zone.fhi)
  const delta    = getDelta(zone.signals)
  const sigs     = zone.signals
  const allZones = Object.values(allZonesMap)

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
              <button
                key={id}
                className={`zone-tab ${activeZone === id ? 'active' : ''} ${activeZone === id && zone.status === 'healthy' ? 'healthy' : ''}`}
                onClick={() => setActiveZone(id)}
                style={{ transition: 'all 0.2s ease' }}
              >
                {z.name}
              </button>
            ))}
            <button className="btn btn-ghost btn-sm"><Plus size={14}/>Add Zone</button>
          </div>
        </div>
        <div className="top-bar-right">
          <span className="sat-info">Last update: {new Date(zone.lastUpdated).toLocaleTimeString()}</span>
          <div className="notif-bell">
            <Bell size={18} />
            <span className="bell-badge">{zone.fire.count > 0 ? zone.fire.count : 0}</span>
          </div>
          <div className="user-avatar"><User size={16}/></div>
        </div>
      </div>

      {/* ── Data Source Indicators ──────────────────────────────────── */}
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

      {/* ── Main Grid ───────────────────────────────────────────────── */}
      <div className="two-col col-60-40" style={{ minHeight: 460 }}>

        {/* Left: Real Leaflet Map */}
        <ZoneMap
          zones={allZones}
          selectedZoneId={activeZone}
          onZoneClick={id => { if (ZONES[id]) setActiveZone(id) }}
          showDraw={false}
          showSearch={false}
          defaultColorMode="ndvi"
          height={460}
        />

        {/* Right Column */}
        <div className="stack" key={activeZone}>
          {/* FHI Score */}
          <div className="card">
            <div className="card-title">FOREST HEALTH INDEX</div>
            <div className="mono text-mono-green" style={{ fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>{zone.name.toUpperCase()}</div>
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
              <span className={delta.dir === 'down' ? 'text-red' : 'text-green'} style={{ fontSize: 12 }}>{delta.text}</span>
            </div>
          </div>

          {/* Signal Breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Contributors</div>
            {[
              { label: 'NDVI Canopy',   val: sigs.ndvi,         color: '#22A95C', source: 'Copernicus' },
              { label: 'Biodiversity',  val: sigs.biodiversity,  color: '#0EA58C', source: 'GBIF + eBird' },
              { label: 'Thermal Risk',  val: sigs.thermalRisk,   color: '#DC3545', source: 'NASA FIRMS' },
              { label: 'Moisture',      val: sigs.moisture,      color: '#3B82F6', source: 'OpenWeather' },
              { label: 'Cover Health',  val: sigs.coverHealth,   color: '#8B5CF6', source: 'GFW' },
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

          {/* 30-Day Trend */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">30-Day Trend</div>
              <span className="text-muted" style={{ fontSize: 11 }}>
                {new Date(Date.now() - 30*86400000).toLocaleDateString('en-US', {month:'short',day:'numeric'})} — {new Date().toLocaleDateString('en-US', {month:'short',day:'numeric'})}
              </span>
            </div>
            <div className="chart-container" style={{ height: 160 }}>
              <Line
                data={{
                  labels: trend.labels,
                  datasets: [{
                    data: trend.data,
                    borderColor: '#22A95C', borderWidth: 2,
                    pointRadius: 0, pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#22A95C', pointHoverBorderColor: '#FFFFFF', pointHoverBorderWidth: 2,
                    fill: true,
                    backgroundColor: (ctx) => {
                      const { ctx: c, chartArea } = ctx.chart
                      if (!chartArea) return 'transparent'
                      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
                      g.addColorStop(0, 'rgba(34,169,92,0.12)')
                      g.addColorStop(0.6, 'rgba(217,119,6,0.05)')
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
                    tooltip: {
                      backgroundColor: '#FFFFFF', borderColor: '#E0E8E2', borderWidth: 1,
                      titleColor: '#1A2E1E', bodyColor: '#1B7A3D',
                      bodyFont: { family: 'JetBrains Mono' }, padding: 10,
                      displayColors: false,
                      callbacks: { label: (ctx) => `FHI: ${ctx.parsed.y.toFixed(1)}` }
                    }
                  },
                  scales: {
                    x: {
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    },
                    y: {
                      min: 0, max: 100,
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 25 },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    }
                  },
                  interaction: { intersect: false, mode: 'index' },
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 20, height: 0, borderTop: '2px dashed #D97706' }}></span>
              <span style={{ fontSize: 10, color: '#D97706' }}>Watch Threshold (50)</span>
            </div>
          </div>

          {/* Quick Stats */}
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

      {/* ── Alert Ticker ────────────────────────────────────────────── */}
      <div className="alert-ticker">
        {zone.fire.count > 5 && (
          <div className="alert-tick-card critical">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-red">
                <span className="severity-dot bg-red"></span>
                CRITICAL — {zone.name}
              </div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — {zone.fire.count} thermal anomalies detected by NASA FIRMS</div>
            <button className="btn btn-ghost-red btn-sm">DISPATCH RANGER</button>
          </div>
        )}
        {zone.status === 'watch' && (
          <div className="alert-tick-card watch">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-amber">
                <span className="severity-dot bg-amber"></span>
                WATCH — {zone.name}
              </div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — Biodiversity score: {sigs.biodiversity}%, Moisture: {sigs.moisture}%</div>
            <button className="btn btn-ghost-amber btn-sm">VIEW DETAILS</button>
          </div>
        )}
        {zone.status === 'healthy' && (
          <div className="alert-tick-card healthy">
            <div className="alert-tick-header">
              <div className="alert-tick-severity text-green">
                <span className="severity-dot bg-green"></span>
                HEALTHY — {zone.name}
              </div>
              <span className="alert-tick-time">{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} IST</span>
            </div>
            <div className="alert-tick-msg">FHI: {zone.fhi} — All signals stable</div>
          </div>
        )}
      </div>
    </>
  )
}