import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Filler, Tooltip as ChartTooltip, Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, ChartTooltip, Legend)

const carbonData = [
  { zone: 'Corbett-A', value: 2847, color: '#D97706', status: 'Declining' },
  { zone: 'Corbett-B', value: 4102, color: '#22A95C', status: 'Stable' },
  { zone: 'Sundarbans-A', value: 3891, color: '#22A95C', status: 'Stable' },
  { zone: 'Sundarbans-B', value: 589, color: '#DC3545', status: 'Critical loss' },
]

const heatmapData = [
  { zone: 'Corbett-A', ndvi: 68, bio: 48, thermal: 22, moisture: 61 },
  { zone: 'Corbett-B', ndvi: 82, bio: 71, thermal: 85, moisture: 74 },
  { zone: 'Sundarbans-A', ndvi: 74, bio: 62, thermal: 56, moisture: 52 },
  { zone: 'Sundarbans-B', ndvi: 35, bio: 31, thermal: 18, moisture: 28 },
]

function heatColor(val) {
  if (val >= 70) return 'rgba(34, 169, 92, 0.55)'
  if (val >= 50) return 'rgba(34, 169, 92, 0.25)'
  if (val >= 35) return 'rgba(217, 119, 6, 0.4)'
  return 'rgba(220, 53, 69, 0.4)'
}

function gen14DayHistory() {
  const data = []
  for (let i = 13; i >= 0; i--) {
    data.push(48 + Math.random()*8 - (i < 5 ? (5-i)*3 : 0))
  }
  return data
}

function gen7DayPrediction() {
  const data = []
  let val = 42
  for (let i = 0; i < 7; i++) {
    val -= 2 + Math.random()*3
    data.push(Math.max(10, val))
  }
  return data
}

const hist = gen14DayHistory()
const pred = gen7DayPrediction()

export default function Analytics() {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4']

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

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-value text-amber">52</div>
          <div className="stat-card-label">Avg FHI (All Zones)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-red">23</div>
          <div className="stat-card-label">Thermal Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-green">11,429t</div>
          <div className="stat-card-label">Carbon Stock CO₂</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-amber">2 of 4</div>
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
                data={{
                  labels: weeks,
                  datasets: [
                    {
                      label: 'Corbett-A',
                      data: [52, 48, 44, 38],
                      backgroundColor: '#D97706',
                      borderRadius: 4,
                      barPercentage: 0.7,
                      categoryPercentage: 0.7,
                    },
                    {
                      label: 'Corbett-B',
                      data: [76, 78, 77, 78],
                      backgroundColor: '#22A95C',
                      borderRadius: 4,
                      barPercentage: 0.7,
                      categoryPercentage: 0.7,
                    },
                    {
                      label: 'Sundarbans-A',
                      data: [65, 63, 62, 61],
                      backgroundColor: '#0EA58C',
                      borderRadius: 4,
                      barPercentage: 0.7,
                      categoryPercentage: 0.7,
                    },
                    {
                      label: 'Sundarbans-B',
                      data: [40, 35, 30, 28],
                      backgroundColor: '#C95C0C',
                      borderRadius: 4,
                      barPercentage: 0.7,
                      categoryPercentage: 0.7,
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

          {/* Carbon Stock */}
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
                    width: `${(c.value / 4200) * 100}%`,
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
          {/* Signal Heatmap */}
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
                  <>
                    <div key={row.zone} className="heatmap-label">{row.zone}</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.ndvi) }}>{row.ndvi}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.bio) }}>{row.bio}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.thermal) }}>{row.thermal}%</div>
                    <div className="heatmap-cell" style={{ background: heatColor(row.moisture) }}>{row.moisture}%</div>
                  </>
                ))}
              </div>
            </div>
          </div>

          {/* 7-Day Risk Forecast */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Predicted FHI — Next 7 Days</div>
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
              Tipping point risk: Day 5
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
