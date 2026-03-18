import { useEffect, useRef } from 'react'
import { Bell, User, Plus } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import ForestMap from '../components/ForestMap'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

function generateTrendData() {
  const labels = []
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    if (i > 20) data.push(62 + Math.random() * 8)
    else if (i > 10) data.push(55 + Math.random() * 6)
    else if (i > 5) data.push(48 + Math.random() * 5)
    else data.push(40 + Math.random() * 5)
  }
  return { labels, data }
}

const trend = generateTrendData()

export default function Dashboard() {
  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div className="breadcrumb"><span>Dashboard</span></div>
        </div>
        <div className="top-bar-center">
          <div className="zone-tabs">
            <button className="zone-tab active">Corbett-A</button>
            <button className="zone-tab active healthy">Corbett-B</button>
            <button className="zone-tab active healthy">Sundarbans-A</button>
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
          <ForestMap activeZone="corbett-a" />
          <div className="map-overlay">
            <div className="live-pill">
              <span className="blink-dot"></span>
              LIVE
            </div>
            <div className="map-tooltip">
              <span className="tooltip-dot" style={{ background: '#F59E0B' }}></span>
              <span>Corbett-A</span>
              <span style={{ color: '#6B8F72', margin: '0 2px' }}>|</span>
              <span className="fhi-val">FHI: 42</span>
              <span style={{ color: '#6B8F72', margin: '0 2px' }}>|</span>
              <span className="badge badge-watch" style={{ fontSize: 9, padding: '1px 6px' }}>WATCH</span>
            </div>
            <div className="map-legend">
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#2ECC71' }}></span> Healthy
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#F59E0B' }}></span> Watch
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#EA580C' }}></span> Alert
              </div>
              <div className="map-legend-item">
                <span className="legend-dot" style={{ background: '#EF4444' }}></span> Critical
              </div>
            </div>
            <div className="map-controls">
              <button>+</button>
              <button>−</button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="stack">
          {/* FHI Score */}
          <div className="card">
            <div className="card-title">FOREST HEALTH INDEX</div>
            <div className="mono text-mono-green" style={{ fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>CORBETT-A</div>
            <div className="mono text-amber" style={{ fontSize: 72, fontWeight: 700, lineHeight: 1 }}>42</div>
            <div style={{ margin: '12px 0' }}>
              <div className="gauge-bar">
                <div className="gauge-dot watch" style={{ left: '42%' }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-watch">WATCH — Declining trend</span>
              <span className="text-red" style={{ fontSize: 12 }}>↓ 18 points vs last month</span>
            </div>
          </div>

          {/* Signal Breakdown */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Contributors</div>
            <div className="progress-row">
              <span className="progress-label">NDVI Canopy</span>
              <div className="progress-track"><div className="progress-fill" style={{ width: '68%', background: '#2ECC71' }}></div></div>
              <span className="progress-value">68%</span>
            </div>
            <div className="progress-row">
              <span className="progress-label">Biodiversity</span>
              <div className="progress-track"><div className="progress-fill" style={{ width: '48%', background: '#00BFA5' }}></div></div>
              <span className="progress-value">48%</span>
            </div>
            <div className="progress-row">
              <span className="progress-label">Thermal Events</span>
              <div className="progress-track"><div className="progress-fill" style={{ width: '22%', background: '#EF4444' }}></div></div>
              <span className="progress-value">22%</span>
            </div>
            <div className="progress-row">
              <span className="progress-label">Moisture Stress</span>
              <div className="progress-track"><div className="progress-fill" style={{ width: '61%', background: '#3B82F6' }}></div></div>
              <span className="progress-value">61%</span>
            </div>
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
                    borderColor: '#2ECC71',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#2ECC71',
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
            {/* Threshold annotation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ width: 20, height: 0, borderTop: '2px dashed #F59E0B' }}></span>
              <span style={{ fontSize: 10, color: '#F59E0B' }}>Watch Threshold (50)</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-mini-card">
              <div className="stat-mini-value text-amber">7</div>
              <div className="stat-mini-label">Thermal Events</div>
              <div className="stat-mini-delta text-amber">↑ HIGH</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-green">2,847t</div>
              <div className="stat-mini-label">Carbon Stock CO₂</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value text-red">5 days</div>
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
