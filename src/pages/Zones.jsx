import { Link } from 'react-router-dom'
import { Search, Plus } from 'lucide-react'
import MiniZoneMap from '../components/MiniZoneMap'

const zones = [
  { id: 'corbett-a', name: 'Corbett-A', fhi: 42, status: 'watch', ndvi: 68, thermal: 7, bio: 48, updated: '4h ago' },
  { id: 'corbett-b', name: 'Corbett-B', fhi: 78, status: 'healthy', ndvi: 82, thermal: 2, bio: 71, updated: '3h ago' },
  { id: 'sundarbans-a', name: 'Sundarbans-A', fhi: 61, status: 'healthy', ndvi: 74, thermal: 4, bio: 62, updated: '5h ago' },
  { id: 'sundarbans-b', name: 'Sundarbans-B', fhi: 28, status: 'alert', ndvi: 35, thermal: 12, bio: 31, updated: '2h ago' },
]

const statusColors = {
  healthy: '#2ECC71',
  watch: '#F59E0B',
  alert: '#EA580C',
  critical: '#EF4444',
}

function getStatusColor(fhi) {
  if (fhi >= 60) return '#2ECC71'
  if (fhi >= 40) return '#F59E0B'
  if (fhi >= 20) return '#EA580C'
  return '#EF4444'
}

export default function Zones() {
  const healthy = zones.filter(z => z.status === 'healthy').length
  const watch = zones.filter(z => z.status === 'watch').length
  const alert = zones.filter(z => z.status === 'alert').length

  return (
    <>
      {/* Top Bar */}
      <div className="top-bar">
        <h1 className="page-title">Forest Zones</h1>
        <div className="top-bar-right">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B8F72' }}/>
            <input className="input" placeholder="Search zones..." style={{ paddingLeft: 30, width: 180 }}/>
          </div>
          <select className="input">
            <option>All Statuses</option>
            <option>Healthy</option>
            <option>Watch</option>
            <option>Alert</option>
            <option>Critical</option>
          </select>
          <button className="btn btn-primary"><Plus size={14}/>Add Zone</button>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="summary-pills">
        <div className="summary-pill">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{zones.length}</span> Total Zones
        </div>
        <div className="summary-pill">
          <span className="pill-dot" style={{ background: '#2ECC71' }}></span>
          <span style={{ color: '#2ECC71', fontWeight: 700 }}>{healthy}</span> Healthy
        </div>
        <div className="summary-pill">
          <span className="pill-dot" style={{ background: '#F59E0B' }}></span>
          <span style={{ color: '#F59E0B', fontWeight: 700 }}>{watch}</span> Watch
        </div>
        <div className="summary-pill">
          <span className="pill-dot" style={{ background: '#EA580C' }}></span>
          <span style={{ color: '#EA580C', fontWeight: 700 }}>{alert}</span> Alert
        </div>
      </div>

      {/* Zone Cards Grid */}
      <div className="zones-grid">
        {zones.map(zone => (
          <div key={zone.id} className={`zone-card ${zone.status}`}>
            <div className="zone-card-header">
              <span className="zone-card-name">{zone.name}</span>
              <span className={`badge badge-${zone.status}`}>{zone.status.toUpperCase()}</span>
            </div>
            <div className="zone-mini-map">
              <MiniZoneMap zone={zone.id} color={statusColors[zone.status]} height={100} />
            </div>
            <div className="zone-card-fhi" style={{ color: getStatusColor(zone.fhi) }}>{zone.fhi}</div>
            <div style={{ margin: '6px 0' }}>
              <div className="gauge-bar" style={{ height: 4 }}>
                <div className="gauge-dot" style={{ left: `${zone.fhi}%`, width: 10, height: 10, background: getStatusColor(zone.fhi) }}></div>
              </div>
            </div>
            <div className="zone-card-stats">
              NDVI: {zone.ndvi}% • Thermal: {zone.thermal} • Bio: {zone.bio}%
            </div>
            <div className="zone-card-footer">
              <span className="updated">Updated {zone.updated}</span>
              <Link to={`/zones/${zone.id}`} className="btn btn-ghost btn-sm">View Details →</Link>
            </div>
          </div>
        ))}
        {/* Add Zone Card */}
        <div className="zone-add-card">
          <Plus size={32}/>
          <span style={{ fontWeight: 600 }}>Add New Zone</span>
        </div>
      </div>
    </>
  )
}
