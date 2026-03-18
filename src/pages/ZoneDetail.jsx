import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import ZoneDetailMap from '../components/ZoneDetailMap'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const zoneData = {
  'corbett-a': {
    name: 'Corbett-A', fhi: 42, status: 'watch', coords: '29.53°N, 78.77°E',
    signals: [
      { name: 'NDVI Canopy', current: 68, prev: 82, color: '#2ECC71' },
      { name: 'Biodiversity', current: 48, prev: 55, color: '#00BFA5' },
      { name: 'Thermal Events', current: 22, prev: 45, color: '#EF4444' },
      { name: 'Moisture Stress', current: 61, prev: 58, color: '#3B82F6' },
    ]
  },
  'corbett-b': {
    name: 'Corbett-B', fhi: 78, status: 'healthy', coords: '29.58°N, 78.82°E',
    signals: [
      { name: 'NDVI Canopy', current: 82, prev: 80, color: '#2ECC71' },
      { name: 'Biodiversity', current: 71, prev: 68, color: '#00BFA5' },
      { name: 'Thermal Events', current: 85, prev: 82, color: '#EF4444' },
      { name: 'Moisture Stress', current: 74, prev: 70, color: '#3B82F6' },
    ]
  },
  'sundarbans-a': {
    name: 'Sundarbans-A', fhi: 61, status: 'healthy', coords: '21.94°N, 88.89°E',
    signals: [
      { name: 'NDVI Canopy', current: 74, prev: 76, color: '#2ECC71' },
      { name: 'Biodiversity', current: 62, prev: 65, color: '#00BFA5' },
      { name: 'Thermal Events', current: 56, prev: 60, color: '#EF4444' },
      { name: 'Moisture Stress', current: 52, prev: 48, color: '#3B82F6' },
    ]
  },
  'sundarbans-b': {
    name: 'Sundarbans-B', fhi: 28, status: 'alert', coords: '21.88°N, 89.02°E',
    signals: [
      { name: 'NDVI Canopy', current: 35, prev: 52, color: '#2ECC71' },
      { name: 'Biodiversity', current: 31, prev: 48, color: '#00BFA5' },
      { name: 'Thermal Events', current: 18, prev: 38, color: '#EF4444' },
      { name: 'Moisture Stress', current: 28, prev: 42, color: '#3B82F6' },
    ]
  },
}

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

const alertLogs = [
  { time: 'Mar 14, 14:22', type: 'CRITICAL', signal: 'NDVI Canopy', value: '22%', action: 'Ranger dispatched', color: '#EF4444' },
  { time: 'Mar 10, 09:15', type: 'WATCH', signal: 'Biodiversity', value: '48%', action: 'Monitoring', color: '#F59E0B' },
  { time: 'Mar 05, 11:30', type: 'WATCH', signal: 'Thermal', value: '7 events', action: 'Under review', color: '#F59E0B' },
]

export default function ZoneDetail() {
  const { zoneId } = useParams()
  const zone = zoneData[zoneId] || zoneData['corbett-a']
  const [activeTab, setActiveTab] = useState('fhi')
  const trend90 = gen90DayData(zone.fhi)
  const color = statusColors[zone.status]

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

      {/* Main Grid */}
      <div className="two-col col-55-45" style={{ minHeight: 360 }}>
        {/* Left: Detailed map */}
        <div className="map-card">
          <ZoneDetailMap zone={zoneId || 'corbett-a'} />
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
            <div className="text-muted" style={{ fontSize: 11 }}>Last calculated: 12 minutes ago</div>
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
                </tr>
              </thead>
              <tbody>
                {zone.signals.map(s => {
                  const delta = s.current - s.prev
                  return (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td className="mono">{s.current}%</td>
                      <td className="mono" style={{ color: '#6B8F72' }}>{s.prev}%</td>
                      <td className={`mono ${delta >= 0 ? 'delta-up' : 'delta-down'}`}>
                        {delta >= 0 ? '↑' : '↓'}{delta >= 0 ? '+' : ''}{delta}%
                      </td>
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
        <div className="card"><div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>NDVI Analysis — Coming soon</div></div>
      )}
      {activeTab === 'alerts' && (
        <div className="card"><div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>Full Alerts Log — Coming soon</div></div>
      )}
      {activeTab === 'carbon' && (
        <div className="card"><div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>Carbon Data — Coming soon</div></div>
      )}
    </>
  )
}
