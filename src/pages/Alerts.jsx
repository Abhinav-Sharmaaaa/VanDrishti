import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, CheckCircle } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones } from '../hooks/useZoneData'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

const colorMap = { critical: '#DC3545', watch: '#D97706', resolved: '#22A95C', alert: '#EA580C' }
const borderMap = { critical: 'critical-border', watch: 'watch-border', resolved: 'healthy-border', alert: 'critical-border' }

function MiniChart({ fhi, color = '#DC3545' }) {
  const labels = Array.from({ length: 14 }, (_, i) => `D${i + 1}`)
  const start = fhi + 20
  const data = labels.map((_, i) => Math.max(5, start - i * ((start - fhi) / 14) + (Math.random() * 4 - 2)))
  return (
    <div style={{ height: 80 }}>
      <Line
        data={{
          labels,
          datasets: [{
            data, borderColor: color, borderWidth: 1.5, pointRadius: 0,
            fill: true, backgroundColor: color + '14', tension: 0.3,
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

/**
 * Generate dynamic alerts from live zone data
 */
function generateAlerts(zones) {
  const alerts = []
  let id = 1

  for (const z of zones) {
    // Critical: High fire count or very low FHI
    if (z.fire.count > 5 || z.fhi < 25) {
      alerts.push({
        id: id++,
        severity: 'critical',
        zone: z.name,
        zoneId: z.id,
        fhi: z.fhi,
        msg: `FHI dropped to ${z.fhi}. ${z.fire.count} thermal anomalies detected by NASA FIRMS. Cover health: ${z.signals.coverHealth}%.`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST — Today',
        recommended: `Dispatch a ranger team for immediate ground verification. ${z.fire.count} fire hotspots in area (NASA FIRMS). Current weather: ${z.weather.temp}°C, humidity ${z.weather.humidity}%.`,
        sources: ['NASA FIRMS', 'Copernicus', 'OpenWeather'],
      })
    }

    // Watch: Declining biodiversity or moderate fire
    if (z.signals.biodiversity < 50 && z.fhi >= 25) {
      alerts.push({
        id: id++,
        severity: 'watch',
        zone: z.name,
        zoneId: z.id,
        fhi: z.fhi,
        msg: `Biodiversity index at ${z.signals.biodiversity}%. ${z.fire.count} thermal anomalies in 7 days. ${z.species.birdSpecies} bird species observed (eBird).`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST — Today',
        recommended: `Increase monitoring frequency. Species count: ${z.species.count} (GBIF). Schedule satellite image analysis for next pass.`,
        sources: ['GBIF', 'eBird', 'NASA FIRMS'],
      })
    }

    // Watch: Moisture stress
    if (z.signals.moisture < 40) {
      alerts.push({
        id: id++,
        severity: 'watch',
        zone: z.name,
        zoneId: z.id,
        fhi: z.fhi,
        msg: `Moisture stress index at ${z.signals.moisture}%. Humidity: ${z.weather.humidity}%. Rainfall: ${z.weather.rainfall}mm.`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST — Today',
        recommended: `Cross-reference with weather forecast. Wind speed: ${z.weather.windSpeed} m/s. If deficit continues, escalate to Alert.`,
        sources: ['OpenWeatherMap'],
      })
    }

    // Healthy / Resolved: stable zones
    if (z.status === 'healthy' && z.fhi >= 70) {
      alerts.push({
        id: id++,
        severity: 'resolved',
        zone: z.name,
        zoneId: z.id,
        fhi: z.fhi,
        msg: `FHI stable at ${z.fhi}. All signals within healthy range. NDVI: ${z.signals.ndvi}%.`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST — Today',
        recommended: 'No action needed. Zone is healthy and stable.',
        resolved: true,
        sources: ['All APIs'],
      })
    }
  }

  return alerts
}

export default function Alerts() {
  const navigate = useNavigate()
  const { zones: zonesMap, loading } = useAllZones(60_000)
  const [expanded, setExpanded] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  if (loading || !Object.keys(zonesMap).length) return <LoadingSpinner message="Loading alerts…" />

  const zones = Object.values(zonesMap)
  const alerts = generateAlerts(zones)

  const filtered = activeFilter === 'all' ? alerts
    : activeFilter === 'resolved' ? alerts.filter(a => a.resolved)
    : alerts.filter(a => a.severity === activeFilter && !a.resolved)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const watchCount = alerts.filter(a => a.severity === 'watch' && !a.resolved).length
  const resolvedCount = alerts.filter(a => a.resolved).length

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

      {/* Stats Row — computed from live data */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-value text-amber">{alerts.filter(a => !a.resolved).length}</div>
          <div className="stat-card-label">Active Alerts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-red">{criticalCount}</div>
          <div className="stat-card-label">Critical</div>
          <div style={{ fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>NASA FIRMS</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-amber">{watchCount}</div>
          <div className="stat-card-label">Watch</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-green">{resolvedCount}</div>
          <div className="stat-card-label">Resolved</div>
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
                {alert.sources && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {alert.sources.map(s => (
                      <span key={s} style={{ fontSize: 8, padding: '1px 6px', borderRadius: 8, background: 'rgba(34,169,92,0.1)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="alert-row-right">
                <span className="alert-row-time">{alert.time}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); navigate(`/zones/${alert.zoneId}`) }}>View Zone</button>
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
                    <MiniChart fhi={alert.fhi} color={colorMap[alert.severity]} />
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
