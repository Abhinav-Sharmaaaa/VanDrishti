import { useState, useCallback } from 'react'
import { ChevronDown, CheckCircle, Send, Phone, Users, AlertTriangle, Flame, Droplets, TreePine, Bird } from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip
} from 'chart.js'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones } from '../hooks/useZoneData'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

// ── Colour maps ───────────────────────────────────────────────────────────────
const colorMap  = { critical: '#DC3545', watch: '#D97706', resolved: '#22A95C', alert: '#EA580C' }
const borderMap = { critical: 'critical-border', watch: 'watch-border', resolved: 'healthy-border', alert: 'critical-border' }

// ── Government team registry ──────────────────────────────────────────────────
// Each team has an ID, name, designation, contact, and the problem types they handle.
const GOVT_TEAMS = {
  dfo: {
    id: 'dfo',
    name: 'District Forest Officer',
    dept: 'State Forest Department',
    contact: '+91-1378-222001',
    icon: TreePine,
    color: '#22A95C',
    handles: ['canopy_decline', 'deforestation', 'multi'],
  },
  rfo: {
    id: 'rfo',
    name: 'Range Forest Officer',
    dept: 'Forest Range Division',
    contact: '+91-1378-222045',
    icon: TreePine,
    color: '#16A34A',
    handles: ['canopy_decline', 'biodiversity_loss', 'moisture_stress'],
  },
  fire_dept: {
    id: 'fire_dept',
    name: 'State Fire & Emergency Services',
    dept: 'Uttarakhand Fire Dept.',
    contact: '+91-1378-101',
    icon: Flame,
    color: '#DC3545',
    handles: ['fire_outbreak', 'thermal_anomaly'],
  },
  ranger: {
    id: 'ranger',
    name: 'Forest Ranger Team',
    dept: 'Field Operations Unit',
    contact: '+91-98765-43210',
    icon: Users,
    color: '#D97706',
    handles: ['fire_outbreak', 'thermal_anomaly', 'biodiversity_loss', 'poaching_risk'],
  },
  wildlife: {
    id: 'wildlife',
    name: 'Wildlife Warden',
    dept: 'Wildlife Crime Control Bureau',
    contact: '+91-1378-222089',
    icon: Bird,
    color: '#0EA58C',
    handles: ['biodiversity_loss', 'poaching_risk'],
  },
  sdrf: {
    id: 'sdrf',
    name: 'State Disaster Response Force',
    dept: 'SDRF Uttarakhand',
    contact: '+91-1378-1077',
    icon: AlertTriangle,
    color: '#7C3AED',
    handles: ['multi', 'fire_outbreak'],
  },
  irrigation: {
    id: 'irrigation',
    name: 'State Irrigation Dept.',
    dept: 'Water Resource Division',
    contact: '+91-1378-222110',
    icon: Droplets,
    color: '#3B82F6',
    handles: ['moisture_stress', 'drought'],
  },
}

// ── Problem classifier ────────────────────────────────────────────────────────
// Given a zone, return an array of problem types and the teams to dispatch.
function classifyProblems(zone) {
  const problems = []

  if (zone.fire.count > 5 || zone.fhi < 25) {
    problems.push({
      type: 'fire_outbreak',
      label: 'Fire / Thermal Outbreak',
      description: `${zone.fire.count} thermal anomalies detected by NASA FIRMS. Immediate ground verification required.`,
      severity: 'critical',
      teams: [GOVT_TEAMS.fire_dept, GOVT_TEAMS.ranger, GOVT_TEAMS.sdrf],
      icon: Flame,
      color: '#DC3545',
    })
  }

  if (zone.signals.thermalRisk >= 30 && zone.fire.count <= 5 && zone.fhi >= 25) {
    problems.push({
      type: 'thermal_anomaly',
      label: 'Thermal Anomaly — Elevated Risk',
      description: `Thermal risk index at ${zone.signals.thermalRisk}%. ${zone.fire.count} anomalies detected. Monitoring escalation recommended.`,
      severity: 'watch',
      teams: [GOVT_TEAMS.ranger, GOVT_TEAMS.rfo],
      icon: Flame,
      color: '#EA580C',
    })
  }

  if (zone.signals.biodiversity < 50) {
    problems.push({
      type: 'biodiversity_loss',
      label: 'Biodiversity Decline',
      description: `Biodiversity index at ${zone.signals.biodiversity}%. Only ${zone.species.birdSpecies} bird species observed (eBird). ${zone.species.count} total species (GBIF).`,
      severity: 'watch',
      teams: [GOVT_TEAMS.wildlife, GOVT_TEAMS.rfo],
      icon: Bird,
      color: '#0EA58C',
    })
  }

  if (zone.signals.moisture < 40) {
    problems.push({
      type: 'moisture_stress',
      label: 'Moisture Stress / Drought Risk',
      description: `Moisture index at ${zone.signals.moisture}%. Humidity: ${zone.weather.humidity}%. Rainfall: ${zone.weather.rainfall}mm. Prolonged deficit risk.`,
      severity: 'watch',
      teams: [GOVT_TEAMS.irrigation, GOVT_TEAMS.rfo],
      icon: Droplets,
      color: '#3B82F6',
    })
  }

  if (zone.signals.ndvi < 40 || zone.signals.coverHealth < 40) {
    problems.push({
      type: 'canopy_decline',
      label: 'Canopy / Cover Health Decline',
      description: `NDVI at ${zone.signals.ndvi}%. Cover health at ${zone.signals.coverHealth}%. Deforestation or canopy stress detected via Copernicus.`,
      severity: zone.signals.ndvi < 25 ? 'critical' : 'watch',
      teams: [GOVT_TEAMS.dfo, GOVT_TEAMS.rfo],
      icon: TreePine,
      color: '#22A95C',
    })
  }

  // Multi-agency if more than 2 problem types
  if (problems.length >= 3) {
    problems.forEach(p => {
      if (!p.teams.find(t => t.id === 'sdrf')) p.teams.push(GOVT_TEAMS.sdrf)
    })
  }

  return problems
}

// ── Mini sparkline ────────────────────────────────────────────────────────────
function MiniChart({ fhi, color = '#DC3545' }) {
  const labels = Array.from({ length: 14 }, (_, i) => `D${i + 1}`)
  const start  = fhi + 20
  const data   = labels.map((_, i) =>
    Math.max(5, start - i * ((start - fhi) / 14) + (Math.random() * 4 - 2))
  )
  return (
    <div style={{ height: 72 }}>
      <Line
        data={{
          labels,
          datasets: [{ data, borderColor: color, borderWidth: 1.5, pointRadius: 0,
            fill: true, backgroundColor: color + '14', tension: 0.3 }]
        }}
        options={{
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, min: 0, max: 100 } },
        }}
      />
    </div>
  )
}

// ── Dispatch button ───────────────────────────────────────────────────────────
function DispatchButton({ team, dispatched, onDispatch }) {
  const Icon = team.icon
  const sent = dispatched.has(team.id)
  return (
    <button
      onClick={() => !sent && onDispatch(team.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
        border: `1.5px solid ${sent ? team.color : team.color + '55'}`,
        background: sent ? team.color + '18' : 'transparent',
        color: sent ? team.color : '#6B8872',
        cursor: sent ? 'default' : 'pointer',
        transition: 'all 0.2s',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <Icon size={11} />
      {sent ? '✓ Alert Sent' : `Dispatch`}
    </button>
  )
}

// ── Team card ─────────────────────────────────────────────────────────────────
function TeamCard({ team, dispatched, onDispatch }) {
  const Icon = team.icon
  const sent = dispatched.has(team.id)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px', borderRadius: 10,
      background: sent ? team.color + '10' : '#F8FBF9',
      border: `1px solid ${sent ? team.color + '44' : '#E0E8E2'}`,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: team.color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={14} color={team.color} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2E1E' }}>{team.name}</div>
          <div style={{ fontSize: 10, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>
            {team.dept}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <a href={`tel:${team.contact}`} style={{
          fontSize: 10, color: '#6B8872', fontFamily: 'var(--font-mono)',
          textDecoration: 'none',
        }}>
          <Phone size={10} style={{ marginRight: 3, verticalAlign: 'middle' }} />
          {team.contact}
        </a>
        <DispatchButton team={team} dispatched={dispatched} onDispatch={onDispatch} />
      </div>
    </div>
  )
}

// ── Problem badge ─────────────────────────────────────────────────────────────
function ProblemBadge({ label, color, icon: Icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
      background: color + '18', color, fontFamily: 'var(--font-mono)',
      border: `1px solid ${color}33`,
    }}>
      <Icon size={9} />
      {label.toUpperCase()}
    </span>
  )
}

// ── Alert generation ──────────────────────────────────────────────────────────
function generateAlerts(zones) {
  const alerts = []
  let id = 1

  for (const z of zones) {
    const problems = classifyProblems(z)

    if (problems.length === 0) {
      // Healthy zone
      if (z.status === 'healthy' && z.fhi >= 70) {
        alerts.push({
          id: id++, severity: 'resolved', zone: z.name, zoneId: z.id, fhi: z.fhi,
          msg: `FHI stable at ${z.fhi}. All signals within healthy range. NDVI: ${z.signals.ndvi}%.`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST',
          problems: [],
          teams: [],
          recommended: 'No action needed. Zone is healthy and stable.',
          resolved: true,
          sources: ['All APIs'],
        })
      }
      continue
    }

    // Collect all unique teams across problems
    const allTeams = []
    const seenTeamIds = new Set()
    for (const p of problems) {
      for (const t of p.teams) {
        if (!seenTeamIds.has(t.id)) {
          allTeams.push(t)
          seenTeamIds.add(t.id)
        }
      }
    }

    const topSeverity = problems.some(p => p.severity === 'critical') ? 'critical' : 'watch'
    const mainProblem = problems[0]

    const sources = ['NASA FIRMS', 'Copernicus', 'GBIF', 'eBird', 'OpenWeatherMap']
      .filter((_, i) => i < problems.length + 1)

    alerts.push({
      id: id++,
      severity: topSeverity,
      zone: z.name,
      zoneId: z.id,
      fhi: z.fhi,
      msg: `${problems.length} problem${problems.length > 1 ? 's' : ''} detected — ${problems.map(p => p.label).join(' · ')}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' IST',
      problems,
      teams: allTeams,
      recommended: mainProblem.description,
      resolved: false,
      sources,
    })
  }

  return alerts
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Alerts() {
  const { zones: zonesMap, loading } = useAllZones(60_000)
  const [expanded,      setExpanded]      = useState(null)
  const [activeFilter,  setActiveFilter]  = useState('all')
  // dispatched: Map of alertId → Set of dispatched teamIds
  const [dispatched, setDispatched] = useState({})
  // dispatchLog for activity feed
  const [dispatchLog, setDispatchLog] = useState([])

  const handleDispatch = useCallback((alertId, teamId, zone) => {
    setDispatched(prev => {
      const current = prev[alertId] ? new Set(prev[alertId]) : new Set()
      current.add(teamId)
      return { ...prev, [alertId]: current }
    })
    const team = Object.values(GOVT_TEAMS).find(t => t.id === teamId)
    setDispatchLog(prev => [
      {
        id: Date.now(),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        team: team.name,
        dept: team.dept,
        zone,
        color: team.color,
      },
      ...prev.slice(0, 9),
    ])
  }, [])

  if (loading || !Object.keys(zonesMap).length) return <LoadingSpinner message="Loading alerts…" />

  const zones  = Object.values(zonesMap)
  const alerts = generateAlerts(zones)

  const filtered = activeFilter === 'all'      ? alerts
    : activeFilter === 'resolved'              ? alerts.filter(a => a.resolved)
    : alerts.filter(a => a.severity === activeFilter && !a.resolved)

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const watchCount    = alerts.filter(a => a.severity === 'watch' && !a.resolved).length
  const resolvedCount = alerts.filter(a => a.resolved).length
  const totalDispatched = Object.values(dispatched).reduce((sum, set) => sum + set.size, 0)

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title">Alert Center</h1>
        <div className="top-bar-right">
          <div className="filter-pills">
            {['all', 'critical', 'watch', 'resolved'].map(f => (
              <button key={f}
                className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm">Export Report</button>
        </div>
      </div>

      {/* Stats Row */}
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
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: '#7C3AED' }}>{totalDispatched}</div>
          <div className="stat-card-label">Teams Dispatched</div>
        </div>
      </div>

      {/* Layout: alerts left, dispatch log right */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ── Alert list ─────────────────────────────────────────────────── */}
        <div className="alert-list" style={{ flex: 1, minWidth: 0 }}>
          {filtered.map(alert => {
            const alertDispatched = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
            const allDispatched = alert.teams.length > 0 && alert.teams.every(t => alertDispatched.has(t.id))

            return (
              <div key={alert.id}
                className={`alert-row ${borderMap[alert.severity]}`}
                onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}
              >
                {/* Main row */}
                <div className="alert-row-main">
                  <span className="alert-row-icon" style={{ background: colorMap[alert.severity] }} />
                  <div className="alert-row-body">
                    <div className="alert-row-zone">
                      {alert.zone}
                      {alert.resolved && (
                        <span className="badge badge-resolved" style={{ marginLeft: 8, fontSize: 9 }}>RESOLVED</span>
                      )}
                      {allDispatched && !alert.resolved && (
                        <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 7px', borderRadius: 10,
                          background: '#7C3AED18', color: '#7C3AED', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          ALL TEAMS DISPATCHED
                        </span>
                      )}
                    </div>
                    <div className="alert-row-msg">{alert.msg}</div>

                    {/* Problem badges */}
                    {alert.problems.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                        {alert.problems.map(p => (
                          <ProblemBadge key={p.type} label={p.label} color={p.color} icon={p.icon} />
                        ))}
                      </div>
                    )}

                    {/* Data sources */}
                    {alert.sources?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {alert.sources.map(s => (
                          <span key={s} style={{ fontSize: 8, padding: '1px 6px', borderRadius: 8,
                            background: 'rgba(34,169,92,0.1)', color: '#6B8872',
                            fontFamily: 'var(--font-mono)' }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="alert-row-right">
                    <span className="alert-row-time">{alert.time}</span>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {!alert.resolved && alert.teams.slice(0, 2).map(team => (
                        <DispatchButton
                          key={team.id}
                          team={team}
                          dispatched={alertDispatched}
                          onDispatch={(teamId) => handleDispatch(alert.id, teamId, alert.zone)}
                        />
                      ))}
                    </div>
                    <ChevronDown
                      size={15}
                      className={`alert-expand-icon ${expanded === alert.id ? 'open' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === alert.id && (
                  <div className="alert-detail">

                    {/* Problems breakdown */}
                    {alert.problems.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div className="card-title" style={{ marginBottom: 8 }}>Detected Problems</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {alert.problems.map(p => {
                            const PIcon = p.icon
                            return (
                              <div key={p.type} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                padding: '8px 12px', borderRadius: 10,
                                background: p.color + '0C',
                                border: `1px solid ${p.color}33`,
                              }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                                  background: p.color + '20',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <PIcon size={13} color={p.color} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: p.color, marginBottom: 2 }}>
                                    {p.label}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#4B5563', lineHeight: 1.5 }}>
                                    {p.description}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="alert-detail-body">
                      {/* FHI sparkline */}
                      <div>
                        <div className="card-title" style={{ marginBottom: 8 }}>FHI Trend</div>
                        <MiniChart fhi={alert.fhi} color={colorMap[alert.severity]} />
                        <div style={{ fontSize: 10, color: '#6B8872', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                          Current FHI: {alert.fhi} · Status: {alert.severity.toUpperCase()}
                        </div>
                      </div>

                      {/* Recommended action */}
                      <div>
                        <div className="card-title" style={{ marginBottom: 8 }}>Recommended Action</div>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {alert.recommended}
                        </p>
                        <div style={{ marginTop: 8, fontSize: 10, color: '#6B8872',
                          fontFamily: 'var(--font-mono)', padding: '6px 10px',
                          background: '#F0F5F1', borderRadius: 8 }}>
                          Zone: {alert.zone} · FHI {alert.fhi} · {alert.time} IST
                        </div>
                      </div>
                    </div>

                    {/* Government team dispatch section */}
                    {alert.teams.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div className="card-title">Dispatch to Government Teams</div>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              alert.teams.forEach(t => {
                                if (!alertDispatched.has(t.id)) {
                                  handleDispatch(alert.id, t.id, alert.zone)
                                }
                              })
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              padding: '4px 12px', borderRadius: 8, fontSize: 11,
                              fontWeight: 700, cursor: 'pointer',
                              background: '#1A2E1E', color: '#7ED9A0',
                              border: 'none', fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <Send size={11} /> Dispatch All
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {alert.teams.map(team => (
                            <TeamCard
                              key={team.id}
                              team={team}
                              dispatched={alertDispatched}
                              onDispatch={(teamId) => {
                                handleDispatch(alert.id, teamId, alert.zone)
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="alert-detail-actions" style={{ marginTop: 12 }}>
                      <button className="btn btn-primary btn-sm">
                        <CheckCircle size={13} /> Acknowledge
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Dispatch activity log ─────────────────────────────────────── */}
        <div style={{ width: 260, flexShrink: 0, position: 'sticky', top: 16 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Send size={13} color="#22A95C" />
              <div className="card-title" style={{ margin: 0 }}>Dispatch Log</div>
            </div>

            {dispatchLog.length === 0 ? (
              <div style={{ fontSize: 11, color: '#6B8872', textAlign: 'center',
                padding: '20px 0', fontFamily: 'var(--font-mono)' }}>
                No dispatches yet.<br />
                <span style={{ fontSize: 10 }}>Alert a team to see activity here.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dispatchLog.map(entry => (
                  <div key={entry.id} style={{
                    padding: '8px 10px', borderRadius: 10,
                    background: entry.color + '0C',
                    border: `1px solid ${entry.color}33`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: entry.color }}>
                        {entry.team}
                      </span>
                      <span style={{ fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>
                        {entry.time}
                      </span>
                    </div>
                    <div style={{ fontSize: 9.5, color: '#4B5563' }}>
                      Dispatched to <strong>{entry.zone}</strong>
                    </div>
                    <div style={{ fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                      {entry.dept}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {dispatchLog.length > 0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E8F1EA' }}>
                <div style={{ fontSize: 10, color: '#6B8872', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  {totalDispatched} team dispatch{totalDispatched !== 1 ? 'es' : ''} this session
                </div>
              </div>
            )}
          </div>

          {/* Government teams legend */}
          <div className="card" style={{ padding: '14px 16px', marginTop: 12 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Response Teams</div>
            {Object.values(GOVT_TEAMS).map(team => {
              const TIcon = team.icon
              return (
                <div key={team.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0', borderBottom: '1px solid #F0F5F1',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: team.color + '18',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <TIcon size={11} color={team.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#1A2E1E' }}>{team.name}</div>
                    <div style={{ fontSize: 9, color: '#6B8872', fontFamily: 'var(--font-mono)' }}>{team.dept}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}