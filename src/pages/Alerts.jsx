import { useState } from 'react'
import { ChevronDown, CheckCircle } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const alerts = [
  {
    id: 1, severity: 'critical', zone: 'Corbett-A',
    msg: 'FHI dropped to 22. Canopy loss 23% in 14 days. Tipping point in 5 days.',
    time: '14:22 IST — Today',
    recommended: 'Dispatch a ranger team for immediate ground verification. Check for illegal logging or forest fire activity in sectors C-7 through C-12.',
  },
  {
    id: 2, severity: 'watch', zone: 'Sundarbans-A',
    msg: 'Biodiversity index declining. 4 thermal anomalies in 48 hours.',
    time: '12:15 IST — Today',
    recommended: 'Increase monitoring frequency. Schedule satellite image analysis for next pass.',
  },
  {
    id: 3, severity: 'watch', zone: 'Corbett-A',
    msg: 'Moisture stress index high. Rainfall deficit confirmed for 18 days.',
    time: '08:30 IST — Today',
    recommended: 'Cross-reference with weather forecast. If deficit continues, escalate to Alert.',
  },
  {
    id: 4, severity: 'resolved', zone: 'Corbett-B',
    msg: 'FHI recovered to 78. Previously flagged zone now stable.',
    time: '10:00 IST — Yesterday',
    recommended: 'No action needed. Zone recovered naturally.',
    resolved: true,
  },
]

const severityMap = { critical: 'critical', watch: 'watch', resolved: 'healthy' }
const colorMap = { critical: '#DC3545', watch: '#D97706', resolved: '#22A95C' }
const borderMap = { critical: 'critical-border', watch: 'watch-border', resolved: 'healthy-border' }

function MiniChart() {
  const labels = Array.from({ length: 14 }, (_, i) => `D${i + 1}`)
  const data = [62, 58, 55, 52, 48, 45, 42, 38, 35, 30, 28, 25, 24, 22]
  return (
    <div style={{ height: 80 }}>
      <Line
        data={{
          labels,
          datasets: [{
            data, borderColor: '#DC3545', borderWidth: 1.5, pointRadius: 0,
            fill: true, backgroundColor: 'rgba(220,53,69,0.08)', tension: 0.3,
          }]
        }}
        options={{
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false, min: 0, max: 100 }
          }
        }}
      />
    </div>
  )
}

export default function Alerts() {
  const [expanded, setExpanded] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  const filtered = activeFilter === 'all' ? alerts
    : activeFilter === 'resolved' ? alerts.filter(a => a.resolved)
    : alerts.filter(a => a.severity === activeFilter && !a.resolved)

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title">Alert Center</h1>
        <div className="top-bar-right">
          <div className="filter-pills">
            {['all', 'critical', 'watch', 'resolved'].map(f => (
              <button key={f} className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm">Mark All Read</button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-value text-amber">3</div>
          <div className="stat-card-label">Unread Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-red">1</div>
          <div className="stat-card-label">Critical</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-amber">2</div>
          <div className="stat-card-label">Watch</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-green">14</div>
          <div className="stat-card-label">Resolved this week</div>
        </div>
      </div>

      {/* Alert List */}
      <div className="alert-list">
        {filtered.map(alert => (
          <div key={alert.id} className={`alert-row ${borderMap[alert.severity]}`}
            onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
            <div className="alert-row-main">
              <span className="alert-row-icon" style={{ background: colorMap[alert.severity] }}></span>
              <div className="alert-row-body">
                <div className="alert-row-zone">
                  {alert.zone}
                  {alert.resolved && <span className="badge badge-resolved" style={{ marginLeft: 8, fontSize: 9 }}>RESOLVED</span>}
                </div>
                <div className="alert-row-msg">{alert.msg}</div>
              </div>
              <div className="alert-row-right">
                <span className="alert-row-time">{alert.time}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={e => e.stopPropagation()}>View Zone</button>
                  {!alert.resolved && (
                    <button className="btn btn-primary btn-sm" onClick={e => e.stopPropagation()}>Dispatch Ranger</button>
                  )}
                </div>
                <ChevronDown
                  size={16}
                  className={`alert-expand-icon ${expanded === alert.id ? 'open' : ''}`}
                />
              </div>
            </div>

            {expanded === alert.id && (
              <div className="alert-detail">
                <div className="alert-detail-body">
                  <div>
                    <div className="card-title" style={{ marginBottom: 8 }}>FHI Timeline</div>
                    <MiniChart />
                  </div>
                  <div>
                    <div className="card-title" style={{ marginBottom: 8 }}>Recommended Action</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{alert.recommended}</p>
                  </div>
                </div>
                <div className="alert-detail-actions">
                  <button className="btn btn-primary btn-sm">
                    <CheckCircle size={14}/>Acknowledge
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
