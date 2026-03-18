import { useState } from 'react'
import { Bell, User, Plus } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import ForestMap from '../components/ForestMap'
import AnimatedCounter from '../components/AnimatedCounter'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const zoneInfo = {
  'corbett-a': { name: 'Corbett-A', fhi: 42, status: 'watch', label: 'WATCH — Declining trend', delta: '↓ 18 points vs last month', ndvi: 68, bio: 48, thermal: 22, moisture: 61, thermalEvents: 7, carbon: '2,847t', tipping: '5 days' },
  'corbett-b': { name: 'Corbett-B', fhi: 78, status: 'healthy', label: 'HEALTHY — Stable', delta: '↑ 3 points vs last month', ndvi: 82, bio: 71, thermal: 85, moisture: 74, thermalEvents: 1, carbon: '4,102t', tipping: '—' },
  'sundarbans-a': { name: 'Sundarbans-A', fhi: 61, status: 'healthy', label: 'HEALTHY — Minor variance', delta: '↓ 4 points vs last month', ndvi: 74, bio: 62, thermal: 56, moisture: 52, thermalEvents: 4, carbon: '3,891t', tipping: '12 days' },
}

const statusColors = { healthy: '#22A95C', watch: '#D97706', alert: '#C95C0C', critical: '#DC3545' }

function generateTrendData(fhi) {
  const labels = []
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    if (i > 20) data.push(fhi + 20 + Math.random() * 8)
    else if (i > 10) data.push(fhi + 10 + Math.random() * 6)
    else if (i > 5) data.push(fhi + 5 + Math.random() * 5)
    else data.push(fhi + Math.random() * 5 - 2)
  }
  return { labels, data }
}

export default function Dashboard() {
  const [activeZone, setActiveZone] = useState('corbett-a')
  const zone = zoneInfo[activeZone]
  const color = statusColors[zone.status]
  const trend = generateTrendData(zone.fhi)

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="breadcrumb"><span>Dashboard</span></div>
        </div>
        <div className="top-bar-center">
          <div className="zone-tabs">
            {Object.entries(zoneInfo).map(([id, z]) => (
              <button
                key={id}
                className={`zone-tab ${activeZone === id ? 'active' : ''} ${activeZone === id && z.status === 'healthy' ? 'healthy' : ''}`}
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
          <span className="sat-info">Last satellite pass: 4h 23m ago</span>
          <div className="notif-bell">
            <Bell size={18} />
            <span className="bell-badge">3</span>
          </div>
          <div className="user-avatar"><User size={16}/></div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="two-col col-60-40" style={{ minHeight: 460 }}>
        {/* Left: Map */}
        <div className="map-card">
          <ForestMap activeZone={activeZone} />
          <div className="map-overlay">
            <div className="live-pill">
              <span className="blink-dot"></span>
              LIVE
            </div>
            <div className="map-tooltip">
              <span className="tooltip-dot" style={{ background: color }}></span>
              <span>{zone.name}</span>
              <span style={{ color: '#6B8872', margin: '0 2px' }}>|</span>
              <span className="fhi-val">FHI: {zone.fhi}</span>
              <span style={{ color: '#6B8872', margin: '0 2px' }}>|</span>
              <span className={`badge badge-${zone.status}`} style={{ fontSize: 9, padding: '1px 6px' }}>{zone.status.toUpperCase()}</span>
            </div>
            <div className="map-legend">
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#22A95C' }}></span> Healthy
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#D97706' }}></span> Watch
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#C95C0C' }}></span> Alert
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#DC3545' }}></span> Critical
              </div>
            </div>
            <div className="map-controls">
              <button>+</button>
              <button>−</button>
            </div>
          </div>
        </div>

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
              <span className={`badge badge-${zone.status}`}>{zone.label}</span>
              <span className={zone.delta.startsWith('↓') ? 'text-red' : 'text-green'} style={{ fontSize: 12 }}>{zone.delta}</span>
            </div>
          </div>

          {/* Signal Breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Contributors</div>
            {[
              { label: 'NDVI Canopy', val: zone.ndvi, color: '#22A95C' },
              { label: 'Biodiversity', val: zone.bio, color: '#0EA58C' },
              { label: 'Thermal Events', val: zone.thermal, color: '#DC3545' },
              { label: 'Moisture Stress', val: zone.moisture, color: '#3B82F6' },
            ].map(s => (
              <div className="progress-row" key={s.label}>
                <span className="progress-label">{s.label}</span>
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
              <span className="text-muted" style={{ fontSize: 11 }}>Feb 16 — Mar 18</span>
            </div>
            <div className="chart-container" style={{ height: 160 }}>
              <Line
                data={{
                  labels: trend.labels,
                  datasets: [{
                    data: trend.data,
                    borderColor: '#22A95C',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#22A95C',
                    pointHoverBorderColor: '#FFFFFF',
                    pointHoverBorderWidth: 2,
                    fill: true,
                    backgroundColor: (ctx) => {
                      const chart = ctx.chart
                      const { ctx: c, chartArea } = chart
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
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E0E8E2',
                      borderWidth: 1,
                      titleColor: '#1A2E1E',
                      bodyColor: '#1B7A3D',
                      bodyFont: { family: 'JetBrains Mono' },
                      padding: 10,
                      displayColors: false,
                      callbacks: {
                        label: (ctx) => `FHI: ${ctx.parsed.y.toFixed(1)}`
                      }
                    }
                  },
                  scales: {
                    x: {
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 6 },
                      grid: { color: 'rgba(180,200,185,0.4)' },
                      border: { color: 'rgba(180,200,185,0.4)' }
                    },
                    y: {
                      min: 0, max: 100,
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 9 }, stepSize: 25 },
                      grid: { color: 'rgba(180,200,185,0.4)' },
                      border: { color: 'rgba(180,200,185,0.4)' }
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
              <div className="stat-mini-value text-amber"><AnimatedCounter value={zone.thermalEvents} /></div>
              <div className="stat-mini-label">Thermal Events</div>
              <div className="stat-mini-delta text-amber">{zone.thermalEvents > 4 ? '↑ HIGH' : '↓ LOW'}</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">{zone.carbon}</div>
              <div className="stat-mini-label">Carbon Stock CO₂</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-red">{zone.tipping}</div>
              <div className="stat-mini-label">Predicted Tipping</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Ticker */}
      <div className="alert-ticker">
        <div className="alert-tick-card critical">
          <div className="alert-tick-header">
            <div className="alert-tick-severity text-red">
              <span className="severity-dot bg-red"></span>
              CRITICAL — Corbett-A
            </div>
            <span className="alert-tick-time">14:22 IST</span>
          </div>
          <div className="alert-tick-msg">FHI: 22 — Canopy loss 23% in 14 days</div>
          <button className="btn btn-ghost-red btn-sm">DISPATCH RANGER</button>
        </div>
        <div className="alert-tick-card watch">
          <div className="alert-tick-header">
            <div className="alert-tick-severity text-amber">
              <span className="severity-dot bg-amber"></span>
              WATCH — Sundarbans-A
            </div>
            <span className="alert-tick-time">12:15 IST</span>
          </div>
          <div className="alert-tick-msg">Biodiversity declining</div>
          <button className="btn btn-ghost-amber btn-sm">VIEW DETAILS</button>
        </div>
        <div className="alert-tick-card healthy">
          <div className="alert-tick-header">
            <div className="alert-tick-severity text-green">
              <span className="severity-dot bg-green"></span>
              HEALTHY — Corbett-B
            </div>
            <span className="alert-tick-time">10:00 IST</span>
          </div>
          <div className="alert-tick-msg">FHI: 78 — All signals stable</div>
        </div>
      </div>
    </>
  )
}
