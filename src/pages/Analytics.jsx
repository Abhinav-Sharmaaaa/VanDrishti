import React from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip as ChartTooltip, Legend
} from 'chart.js'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones } from '../hooks/useZoneData'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, ChartTooltip, Legend)

function heatColor(val) {
  if (val >= 70) return 'rgba(34, 169, 92, 0.55)'
  if (val >= 50) return 'rgba(34, 169, 92, 0.25)'
  if (val >= 35) return 'rgba(217, 119, 6, 0.4)'
  return 'rgba(220, 53, 69, 0.4)'
}

function gen14DayHistory(fhi) {
  const data = []
  for (let i = 13; i >= 0; i--) {
    data.push(fhi + 8 + Math.random() * 8 - (i < 5 ? (5 - i) * 3 : 0))
  }
  return data
}

function gen7DayPrediction(fhi) {
  const data = []
  let val = fhi
  for (let i = 0; i < 7; i++) {
    val -= 2 + Math.random() * 3
    data.push(Math.max(10, val))
  }
  return data
}

export default function Analytics() {
  const { zones: zonesMap, loading } = useAllZones(60_000)

  if (loading || !Object.keys(zonesMap).length) return <LoadingSpinner message="Loading analytics…" />

  const zones = Object.values(zonesMap)
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

  // Compute aggregate stats from live data
  const avgFhi = Math.round(zones.reduce((s, z) => s + z.fhi, 0) / zones.length)
  const totalThermal = zones.reduce((s, z) => s + z.fire.count, 0)
  const totalCarbon = zones.reduce((s, z) => s + z.carbonStock, 0)
  const zonesAtRisk = zones.filter(z => z.status === 'watch' || z.status === 'alert' || z.status === 'critical').length

  // Carbon data from live zone data
  const carbonData = zones.map(z => ({
    zone: z.name,
    value: z.carbonStock,
    color: z.status === 'critical' || z.status === 'alert' ? '#DC3545' : z.status === 'watch' ? '#D97706' : '#22A95C',
    status: z.status === 'critical' ? 'Critical loss' : z.status === 'alert' ? 'Declining' : z.status === 'watch' ? 'Declining' : 'Stable',
  }))

  // Heatmap data from live signals
  const heatmapData = zones.map(z => ({
    zone: z.name,
    ndvi: z.signals.ndvi,
    bio: z.signals.biodiversity,
    thermal: 100 - z.signals.thermalRisk, // invert so high = good
    moisture: z.signals.moisture,
  }))

  // Bar chart: generate weekly FHI approximations from current values
  const barColors = ['#D97706', '#22A95C', '#0EA58C', '#C95C0C', '#DC3545']
  const barDatasets = zones.map((z, i) => ({
    label: z.name,
    data: weeks.map((_, wi) => Math.max(10, z.fhi + (3 - wi) * (Math.random() * 4 + 1) * (z.fhi < 50 ? 1 : -0.3))),
    backgroundColor: barColors[i % barColors.length],
    borderRadius: 4,
    barPercentage: 0.7,
    categoryPercentage: 0.7,
  }))

  // Find worst zone for prediction chart
  const worstZone = zones.reduce((a, b) => a.fhi < b.fhi ? a : b)
  const hist = gen14DayHistory(worstZone.fhi)
  const pred = gen7DayPrediction(worstZone.fhi)

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title">Analytics</h1>
        <div className="top-bar-right">
          <select className="input">
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>Last 90 days</option>
          </select>
          <button className="btn btn-ghost btn-sm">Export PDF</button>
        </div>
      </div>

      {/* Data source indicators */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {zones[0] && Object.entries(zones[0].dataSource).map(([key, src]) => (
          <span key={key} style={{
            fontSize: 9, padding: '2px 8px', borderRadius: 10,
            background: src === 'mock' ? 'rgba(217,119,6,0.12)' : 'rgba(34,169,92,0.12)',
            color: src === 'mock' ? '#D97706' : '#22A95C',
            fontFamily: 'var(--font-mono)',
          }}>{key}: {src}</span>
        ))}
      </div>

      {/* Stats Row — from live aggregations */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-value text-amber">{avgFhi}</div>
          <div className="stat-card-label">Avg FHI (All Zones)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-red">{totalThermal}</div>
          <div className="stat-card-label">Thermal Events</div>
          <div style={{ fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>NASA FIRMS</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-green">{totalCarbon.toLocaleString()}t</div>
          <div className="stat-card-label">Carbon Stock CO₂</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-amber">{zonesAtRisk} of {zones.length}</div>
          <div className="stat-card-label">Zones at Risk</div>
        </div>
      </div>

      <div className="two-col col-50-50">
        {/* Left Column */}
        <div className="stack">
          {/* Zone Comparison */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>FHI Comparison — All Zones</div>
            <div className="chart-container" style={{ height: 240 }}>
              <Bar
                data={{ labels: weeks, datasets: barDatasets }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#6B8872', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 14 }
                    },
                    tooltip: {
                      backgroundColor: '#FFFFFF', borderColor: '#E0E8E2', borderWidth: 1,
                      titleColor: '#1A2E1E', bodyColor: '#1B7A3D',
                      bodyFont: { family: 'JetBrains Mono' }, padding: 10,
                    }
                  },
                  scales: {
                    x: {
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 10 } },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    },
                    y: {
                      min: 0, max: 100,
                      ticks: { color: '#6B8872', font: { family: 'JetBrains Mono', size: 10 }, stepSize: 25 },
                      grid: { color: 'rgba(180,200,185,0.4)' }, border: { color: 'rgba(180,200,185,0.4)' }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Carbon Stock — from live data */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Carbon Stock by Zone</div>
            {carbonData.map(c => (
              <div key={c.zone} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{c.zone}</span>
                  <span className="mono" style={{ fontSize: 12, color: c.color }}>{c.value.toLocaleString()}t</span>
                </div>
                <div className="progress-track" style={{ height: 8 }}>
                  <div className="progress-fill" style={{
                    width: `${(c.value / Math.max(...carbonData.map(d => d.value), 1)) * 100}%`,
                    background: c.color,
                  }}></div>
                </div>
                <span style={{ fontSize: 10, color: c.color, marginTop: 2, display: 'inline-block' }}>{c.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="stack">
          {/* Signal Heatmap — from live data */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Signal Health Overview</div>
            <div style={{ overflowX: 'auto' }}>
              {/* Header */}
              <div className="heatmap-grid" style={{ gridTemplateColumns: '110px repeat(4, 1fr)' }}>
                <div></div>
                {['NDVI', 'Bio', 'Thermal', 'Moisture'].map(h => (
                  <div key={h} className="heatmap-label" style={{ justifyContent: 'center', fontSize: 10, color: '#6B8872' }}>{h}</div>
                ))}
                {heatmapData.map(row => (
                  <React.Fragment key={row.zone}>
                    <div className="heatmap-label">{row.zone}</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.ndvi) }}>{row.ndvi}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.bio) }}>{row.bio}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.thermal) }}>{row.thermal}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.moisture) }}>{row.moisture}%</div>
                  </React.Fragment>
                ))}
              </div>
              <div style={{ fontSize: 9, color: '#6B8872', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                Sources: Copernicus · GBIF · eBird · NASA FIRMS · OpenWeatherMap
              </div>
            </div>
          </div>

          {/* 7-Day Risk Forecast */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Predicted FHI — {worstZone.name} (Next 7 Days)</div>
            <div className="chart-container" style={{ height: 220 }}>
              <Line
                data={{
                  labels: [
                    ...Array.from({ length: 14 }, (_, i) => `D-${14-i}`),
                    ...Array.from({ length: 7 }, (_, i) => `D+${i+1}`),
                  ],
                  datasets: [
                    {
                      label: 'Historical',
                      data: [...hist, ...Array(7).fill(null)],
                      borderColor: '#22A95C',
                      borderWidth: 2,
                      pointRadius: 0,
                      tension: 0.3,
                    },
                    {
                      label: 'Prediction',
                      data: [...Array(13).fill(null), hist[hist.length - 1], ...pred],
                      borderColor: '#D97706',
                      borderWidth: 2,
                      borderDash: [6, 4],
                      pointRadius: 0,
                      fill: true,
                      backgroundColor: 'rgba(217,119,6,0.06)',
                      tension: 0.3,
                    },
                  ]
                }}
                options={{
                  responsive: true, maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { color: '#6B8872', font: { family: 'Inter', size: 11 }, boxWidth: 12, padding: 14 }
                    },
                    tooltip: {
                      backgroundColor: '#FFFFFF', borderColor: '#E0E8E2', borderWidth: 1,
                      titleColor: '#1A2E1E', bodyColor: '#1B7A3D',
                      bodyFont: { family: 'JetBrains Mono' }, padding: 10,
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
            <div style={{ marginTop: 8, fontSize: 11, color: '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
              Tipping point risk: {worstZone.name} (FHI: {worstZone.fhi})
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
