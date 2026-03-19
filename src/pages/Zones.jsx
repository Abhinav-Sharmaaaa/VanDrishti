import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Trash2, Map, LayoutGrid, Droplets, Wind, Thermometer, TreePine, Bird, Leaf, MapPin, Layers, Activity } from 'lucide-react'
import ZoneMap from '../components/ZoneMap'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones, notifyCacheUpdated } from '../hooks/useZoneData'
import { addCustomZone, removeCustomZone } from '../services/dataService'

function getStatusColor(fhi) {
  if (fhi >= 60) return '#2ECC71'
  if (fhi >= 40) return '#F59E0B'
  if (fhi >= 20) return '#EA580C'
  return '#EF4444'
}

function getRiskLabel(fhi) {
  if (fhi >= 75) return 'Excellent'
  if (fhi >= 60) return 'Good'
  if (fhi >= 40) return 'Moderate'
  if (fhi >= 20) return 'Poor'
  return 'Critical'
}

export default function Zones() {
  const { zones: zonesMap, loading } = useAllZones(60_000)
  const [view, setView]             = useState('map')
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatus]   = useState('all')
  const [deleteTarget, setDelete]   = useState(null)
  const [pendingZones, setPending]  = useState([])

  const zones = (() => {
    const base = Object.values(zonesMap)
    const existingIds = new Set(base.map(z => z.id))
    return [...base, ...pendingZones.filter(z => !existingIds.has(z.id))]
  })()

  const filtered = zones.filter(z => {
    const okSearch = !search || z.name.toLowerCase().includes(search.toLowerCase())
    const okStatus = statusFilter === 'all' || z.status === statusFilter
    return okSearch && okStatus
  })

  const counts = {
    healthy:  zones.filter(z => z.status === 'healthy').length,
    watch:    zones.filter(z => z.status === 'watch').length,
    alert:    zones.filter(z => z.status === 'alert').length,
    critical: zones.filter(z => z.status === 'critical').length,
    custom:   zones.filter(z => z.custom).length,
  }

  // Aggregate stats
  const avgFhi = zones.length ? Math.round(zones.reduce((s, z) => s + (z.fhi ?? 0), 0) / zones.filter(z => z.fhi != null).length) : 0
  const totalFires = zones.reduce((s, z) => s + (z.fire?.count ?? 0), 0)
  const totalSpecies = zones.reduce((s, z) => s + (z.species?.count ?? 0), 0)
  const totalCarbon = zones.reduce((s, z) => s + (z.carbonStock ?? 0), 0)

  const selected = selectedId
    ? (zonesMap[selectedId] ?? pendingZones.find(z => z.id === selectedId))
    : null

  useEffect(() => {
    if (Object.keys(zonesMap).length)
      setPending(prev => prev.filter(z => !zonesMap[z.id]))
  }, [zonesMap])

  const handleZoneAdded = useCallback((meta) => {
    addCustomZone(meta)
    setPending(prev => [...prev, {
      ...meta, custom: true, fhi: null, status: 'pending',
      signals: { ndvi: null, biodiversity: null, thermalRisk: null, moisture: null, coverHealth: null },
      fire: { count: 0 }, species: { count: 0, birdSpecies: 0 },
      weather: { temp: null, humidity: null }, placeName: meta.name,
      treeCover: { totalLossHa: 0, coverLossPct: 0 }, carbonStock: 0,
      lastUpdated: new Date().toISOString(),
    }])
    setSelectedId(meta.id)
  }, [])

  const handleZoneDeleted = (id) => {
    removeCustomZone(id)
    notifyCacheUpdated()
    setPending(prev => prev.filter(z => z.id !== id))
    if (selectedId === id) setSelectedId(null)
    setDelete(null)
  }

  if (loading && !zones.length) return <LoadingSpinner message="Loading zones…" />

  return (
    <>
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="top-bar">
        <h1 className="page-title">Forest Zones</h1>
        <div className="top-bar-right">

          <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 3, gap: 2 }}>
            {[['map', <Map size={13}/>, 'Map'], ['grid', <LayoutGrid size={13}/>, 'Grid']].map(([v, icon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                background: view === v ? 'var(--bg-surface)' : 'transparent',
                color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{icon}{label}</button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}/>
            <input className="input" placeholder="Search zones…" value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: 180 }}/>
          </div>

          <select className="input" value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="watch">Watch</option>
            <option value="alert">Alert</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* ── Summary Pills ──────────────────────────────────── */}
      <div className="summary-pills">
        <div className="summary-pill">
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{zones.length}</span> Total
        </div>
        {[['#2ECC71', counts.healthy, 'Healthy'], ['#F59E0B', counts.watch, 'Watch'], ['#EA580C', counts.alert + counts.critical, 'Alert']].map(([color, n, label]) => (
          <div key={label} className="summary-pill">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5 }}/>
            <span style={{ color, fontWeight: 700 }}>{n}</span> {label}
          </div>
        ))}
        {counts.custom > 0 && (
          <div className="summary-pill" style={{ marginLeft: 'auto' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-secondary)' }}>{counts.custom}</span> Custom
          </div>
        )}
      </div>

      {/* ── Aggregate Stats Row ────────────────────────────── */}
      <div className="stats-row" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: getStatusColor(avgFhi) }}>{avgFhi}</div>
          <div className="stat-card-label">Avg. Forest Health</div>
          <div style={{ marginTop: 4 }}>
            <span className={`badge badge-${avgFhi >= 60 ? 'healthy' : avgFhi >= 40 ? 'watch' : 'critical'}`} style={{ fontSize: 9 }}>
              {getRiskLabel(avgFhi)}
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-amber">{totalFires}</div>
          <div className="stat-card-label">Total Thermal Events</div>
          <div className="stat-mini-sub">Across all zones</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value" style={{ color: '#0EA58C' }}>{totalSpecies}</div>
          <div className="stat-card-label">Total Species</div>
          <div className="stat-mini-sub">GBIF + eBird</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value text-green">{totalCarbon.toLocaleString()}t</div>
          <div className="stat-card-label">Total Carbon Stock</div>
          <div className="stat-mini-sub">CO₂ equivalent</div>
        </div>
      </div>

      {/* ── MAP VIEW ───────────────────────────────────────── */}
      {view === 'map' && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ZoneMap
              zones={zones}
              selectedZoneId={selectedId}
              onZoneClick={id => setSelectedId(prev => prev === id ? null : id)}
              onZoneAdded={handleZoneAdded}
              height={560}
              showDraw={true}
              showSearch={true}
              defaultColorMode="status"
            />
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              Toggle Status / NDVI view · Search a location · Draw Zone to add a new monitoring area
            </p>
          </div>

          {/* Side panel */}
          <div style={{ width: 300, flexShrink: 0 }}>
            {selected ? (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={9} /> {selected.coords}
                    </div>
                    {selected.placeName && (
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{selected.placeName}</div>
                    )}
                  </div>
                  <span className={`badge badge-${selected.status}`} style={{ fontSize: 9 }}>{selected.status?.toUpperCase()}</span>
                </div>

                {selected.fhi != null ? (
                  <>
                    {/* FHI Display */}
                    <div style={{ textAlign: 'center', marginBottom: 14, padding: '12px 0', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 44, fontWeight: 700, fontFamily: 'var(--font-mono)', color: getStatusColor(selected.fhi), lineHeight: 1 }}>{selected.fhi}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4 }}>Forest Health Index — {getRiskLabel(selected.fhi)}</div>
                      <div className="gauge-bar" style={{ height: 4, marginTop: 8, width: '80%', marginLeft: '10%' }}>
                        <div className="gauge-dot" style={{ left: `${selected.fhi}%`, width: 10, height: 10, background: getStatusColor(selected.fhi) }}/>
                      </div>
                    </div>

                    {/* Signal Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Signal Breakdown</div>
                      {[
                        ['NDVI Canopy', selected.signals?.ndvi, '%', '#22A95C'],
                        ['Biodiversity', selected.signals?.biodiversity, '%', '#0EA58C'],
                        ['Moisture', selected.signals?.moisture, '%', '#3B82F6'],
                        ['Cover Health', selected.signals?.coverHealth, '%', '#8B5CF6'],
                        ['Thermal Risk', selected.signals?.thermalRisk, '%', '#DC3545'],
                      ].map(([label, val, unit, color]) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{val ?? '—'}{unit}</span>
                          </div>
                          {unit === '%' && val != null && (
                            <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2 }}>
                              <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }}/>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Weather Section */}
                    <div style={{ marginBottom: 14, padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Weather</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <Thermometer size={11} style={{ color: '#D97706' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Temp</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#D97706' }}>{selected.weather?.temp ?? '—'}°C</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <Droplets size={11} style={{ color: '#3B82F6' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Humid</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#3B82F6' }}>{selected.weather?.humidity ?? '—'}%</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <Wind size={11} style={{ color: 'var(--text-secondary)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Wind</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-primary)' }}>{selected.weather?.windSpeed ?? '—'} m/s</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                          <Droplets size={11} style={{ color: '#0EA58C' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Rain</span>
                          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0EA58C' }}>{selected.weather?.rainfall ?? '—'} mm</span>
                        </div>
                      </div>
                      {selected.weather?.condition && (
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Condition: {selected.weather.condition}
                        </div>
                      )}
                    </div>

                    {/* Ecosystem Details */}
                    <div style={{ marginBottom: 14, padding: '10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Ecosystem</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Bird size={11} style={{ color: '#8B5CF6' }} /> Bird Species</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#8B5CF6' }}>{selected.species?.birdSpecies ?? '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Layers size={11} style={{ color: '#0EA58C' }} /> Total Species</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0EA58C' }}>{selected.species?.count ?? '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><TreePine size={11} style={{ color: '#22A95C' }} /> Carbon Stock</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#22A95C' }}>{selected.carbonStock?.toLocaleString() ?? '—'}t</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Leaf size={11} style={{ color: '#D97706' }} /> Tree Cover Loss</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#D97706' }}>{selected.treeCover?.totalLossHa?.toLocaleString() ?? '—'} ha</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)' }}><Activity size={11} style={{ color: '#DC3545' }} /> Fire Events</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#DC3545' }}>{selected.fire?.count ?? '—'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                    Fetching live data…<br/>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>APIs are being queried</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  {selected.fhi != null && (
                    <Link to={`/zones/${selected.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                      View Details →
                    </Link>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setDelete(selected.id)} style={{ color: '#DC3545' }}>
                    <Trash2 size={13}/>
                  </button>
                </div>
                {selected.custom && (
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    Custom zone · drawn on map
                  </div>
                )}
                {selected.lastUpdated && (
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    Updated {new Date(selected.lastUpdated).toLocaleString()}
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ padding: 12, maxHeight: 580, overflowY: 'auto' }}>
                <div className="card-title" style={{ marginBottom: 10 }}>All Zones</div>
                {filtered.map(z => (
                  <div key={z.id} onClick={() => setSelectedId(prev => prev === z.id ? null : z.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '9px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 3,
                      background: z.id === selectedId ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={e => e.currentTarget.style.background = z.id === selectedId ? 'var(--bg-elevated)' : 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{z.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                        {z.fhi != null ? `FHI ${z.fhi} · NDVI ${z.signals?.ndvi ?? '—'}% · 🔥 ${z.fire?.count ?? 0}` : 'Loading…'}
                      </div>
                    </div>
                    <span className={`badge badge-${z.status}`} style={{ fontSize: 8 }}>{z.status?.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GRID VIEW ──────────────────────────────────────── */}
      {view === 'grid' && (
        <div className="zones-grid">
          {filtered.map(zone => (
            <div key={zone.id} className={`zone-card ${zone.status}`}>
              <div className="zone-card-header">
                <div>
                  <span className="zone-card-name">{zone.name}</span>
                  {zone.placeName && (
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <MapPin size={9} /> {zone.placeName}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {zone.custom && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>custom</span>}
                  <span className={`badge badge-${zone.status}`}>{zone.status?.toUpperCase()}</span>
                </div>
              </div>

              {/* NDVI bar preview */}
              <div style={{ height: 72, background: 'var(--bg-elevated)', borderRadius: 8, margin: '8px 0', overflow: 'hidden', border: '1px solid var(--border-subtle)', position: 'relative' }}>
                {zone.signals?.ndvi != null && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${zone.signals.ndvi}%`,
                    background: `linear-gradient(to top, ${zone.signals.ndvi >= 60 ? '#22A95C' : zone.signals.ndvi >= 40 ? '#D97706' : '#DC3545'}44, transparent)`,
                    transition: 'height 0.8s ease',
                  }}/>
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>NDVI</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: zone.signals?.ndvi >= 60 ? '#22A95C' : zone.signals?.ndvi >= 40 ? '#D97706' : '#DC3545' }}>
                    {zone.signals?.ndvi ?? '—'}%
                  </div>
                </div>
              </div>

              {/* FHI + Gauge */}
              <div className="zone-card-fhi" style={{ color: zone.fhi != null ? getStatusColor(zone.fhi) : 'var(--text-secondary)' }}>
                {zone.fhi ?? '…'}
              </div>
              {zone.fhi != null && (
                <div style={{ margin: '6px 0' }}>
                  <div className="gauge-bar" style={{ height: 4 }}>
                    <div className="gauge-dot" style={{ left: `${zone.fhi}%`, width: 10, height: 10, background: getStatusColor(zone.fhi) }}/>
                  </div>
                </div>
              )}

              {/* Signal Stats */}
              <div className="zone-card-stats">
                NDVI: {zone.signals?.ndvi ?? '—'}% • Thermal: {zone.fire?.count ?? '—'} • Bio: {zone.signals?.biodiversity ?? '—'}%
              </div>

              {/* Weather + Species Pills */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(217,119,6,0.1)', color: '#D97706', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Thermometer size={9} /> {zone.weather?.temp ?? '—'}°C
                </span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Droplets size={9} /> {zone.weather?.humidity ?? '—'}%
                </span>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 8, background: 'rgba(14,165,140,0.1)', color: '#0EA58C', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Bird size={9} /> {zone.species?.birdSpecies ?? '—'} spp
                </span>
              </div>

              {/* Extended Details */}
              <div style={{ marginTop: 8, padding: '8px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><TreePine size={9} /> Carbon Stock</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--brand-green)' }}>{zone.carbonStock?.toLocaleString() ?? '—'}t</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Leaf size={9} /> Cover Loss</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#D97706' }}>{zone.treeCover?.totalLossHa?.toLocaleString() ?? '—'} ha</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Layers size={9} /> Species</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0EA58C' }}>{zone.species?.count ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Wind size={9} /> Wind</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>{zone.weather?.windSpeed ?? '—'} m/s</span>
                </div>
                {zone.weather?.condition && (
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: 2 }}>
                    {zone.weather.condition}
                  </div>
                )}
              </div>

              {/* Coordinates */}
              {zone.coords && (
                <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <MapPin size={8} /> {zone.coords}
                </div>
              )}

              <div className="zone-card-footer">
                <span className="updated">Updated {new Date(zone.lastUpdated).toLocaleTimeString()}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setDelete(zone.id)} style={{ color: '#DC3545' }}><Trash2 size={12}/></button>
                  {zone.fhi != null && <Link to={`/zones/${zone.id}`} className="btn btn-ghost btn-sm">View →</Link>}
                </div>
              </div>
            </div>
          ))}
          <div className="zone-add-card" onClick={() => setView('map')}>
            <Plus size={32}/>
            <span style={{ fontWeight: 600 }}>Add New Zone</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Draw on map</span>
          </div>
        </div>
      )}

      {/* ── Delete modal ───────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Delete zone?</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              <strong>{(zonesMap[deleteTarget] ?? pendingZones.find(z => z.id === deleteTarget))?.name}</strong> will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDelete(null)}>Cancel</button>
              <button className="btn btn-sm" onClick={() => handleZoneDeleted(deleteTarget)} style={{ background: '#DC3545', color: '#fff', border: 'none' }}>Delete Zone</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}