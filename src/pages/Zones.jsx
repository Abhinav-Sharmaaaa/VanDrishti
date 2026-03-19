import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Trash2, Map, LayoutGrid } from 'lucide-react'
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
      lastUpdated: new Date().toISOString(),
    }])
    setSelectedId(meta.id)
  }, [])

  const handleZoneDeleted = (id) => {
    removeCustomZone(id)   // already removes from ZONES registry + localStorage cache
    notifyCacheUpdated()   // tell useAllZones to re-read from cache
    setPending(prev => prev.filter(z => z.id !== id))
    if (selectedId === id) setSelectedId(null)
    setDelete(null)
  }

  if (loading && !zones.length) return <LoadingSpinner message="Loading zones…" />

  return (
    <>
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <div className="top-bar">
        <h1 className="page-title">Forest Zones</h1>
        <div className="top-bar-right">

          <div style={{ display: 'flex', background: '#F0F5F1', borderRadius: 8, padding: 3, gap: 2 }}>
            {[['map', <Map size={13}/>, 'Map'], ['grid', <LayoutGrid size={13}/>, 'Grid']].map(([v, icon, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                border: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                background: view === v ? '#fff' : 'transparent',
                color: view === v ? '#1A2E1E' : '#6B8872',
                boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{icon}{label}</button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B8F72' }}/>
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

      {/* ── Summary Pills ─────────────────────────────────────────────── */}
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
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#6B8872' }}>{counts.custom}</span> Custom
          </div>
        )}
      </div>

      {/* ── MAP VIEW ──────────────────────────────────────────────────── */}
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
            <p style={{ fontSize: 10, color: '#9DB8A2', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
              Toggle Status / NDVI view · Search a location · Draw Zone to add a new monitoring area
            </p>
          </div>

          {/* Side panel */}
          <div style={{ width: 256, flexShrink: 0 }}>
            {selected ? (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
                    <div style={{ fontSize: 10, color: '#9DB8A2', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{selected.coords}</div>
                  </div>
                  <span className={`badge badge-${selected.status}`} style={{ fontSize: 9 }}>{selected.status?.toUpperCase()}</span>
                </div>

                {selected.fhi != null ? (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 44, fontWeight: 700, fontFamily: 'var(--font-mono)', color: getStatusColor(selected.fhi), lineHeight: 1 }}>{selected.fhi}</div>
                      <div style={{ fontSize: 10, color: '#6B8872', marginTop: 2 }}>Forest Health Index</div>
                      <div className="gauge-bar" style={{ height: 4, marginTop: 8 }}>
                        <div className="gauge-dot" style={{ left: `${selected.fhi}%`, width: 10, height: 10, background: getStatusColor(selected.fhi) }}/>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                      {[
                        ['NDVI', selected.signals?.ndvi, '%', '#22A95C'],
                        ['Biodiversity', selected.signals?.biodiversity, '%', '#0EA58C'],
                        ['Moisture', selected.signals?.moisture, '%', '#3B82F6'],
                        ['Fire events', selected.fire?.count, '', '#DC3545'],
                        ['Temp', selected.weather?.temp, '°C', '#D97706'],
                      ].map(([label, val, unit, color]) => (
                        <div key={label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                            <span style={{ color: '#6B8872' }}>{label}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color }}>{val ?? '—'}{unit}</span>
                          </div>
                          {unit === '%' && val != null && (
                            <div style={{ height: 3, background: '#E8F1EA', borderRadius: 2 }}>
                              <div style={{ width: `${val}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s' }}/>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#6B8872', fontSize: 12 }}>
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
                  <div style={{ fontSize: 9, color: '#9DB8A2', marginTop: 8, fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                    Custom zone · drawn on map
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
                      background: z.id === selectedId ? '#F0F5F1' : 'transparent', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F0F5F1'}
                    onMouseLeave={e => e.currentTarget.style.background = z.id === selectedId ? '#F0F5F1' : 'transparent'}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{z.name}</div>
                      <div style={{ fontSize: 10, color: '#9DB8A2', fontFamily: 'var(--font-mono)' }}>
                        {z.fhi != null ? `FHI ${z.fhi} · NDVI ${z.signals?.ndvi ?? '—'}%` : 'Loading…'}
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

      {/* ── GRID VIEW ─────────────────────────────────────────────────── */}
      {view === 'grid' && (
        <div className="zones-grid">
          {filtered.map(zone => (
            <div key={zone.id} className={`zone-card ${zone.status}`}>
              <div className="zone-card-header">
                <span className="zone-card-name">{zone.name}</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {zone.custom && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 6, background: 'rgba(107,136,114,0.15)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>custom</span>}
                  <span className={`badge badge-${zone.status}`}>{zone.status?.toUpperCase()}</span>
                </div>
              </div>

              {/* NDVI bar preview */}
              <div style={{ height: 72, background: '#E8F1EA', borderRadius: 8, margin: '8px 0', overflow: 'hidden', border: '1px solid #D4E4D8', position: 'relative' }}>
                {zone.signals?.ndvi != null && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: `${zone.signals.ndvi}%`,
                    background: `linear-gradient(to top, ${zone.signals.ndvi >= 60 ? '#22A95C' : zone.signals.ndvi >= 40 ? '#D97706' : '#DC3545'}44, transparent)`,
                    transition: 'height 0.8s ease',
                  }}/>
                )}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#6B8872' }}>NDVI</div>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: zone.signals?.ndvi >= 60 ? '#22A95C' : zone.signals?.ndvi >= 40 ? '#D97706' : '#DC3545' }}>
                    {zone.signals?.ndvi ?? '—'}%
                  </div>
                </div>
              </div>

              <div className="zone-card-fhi" style={{ color: zone.fhi != null ? getStatusColor(zone.fhi) : '#6B8872' }}>
                {zone.fhi ?? '…'}
              </div>
              {zone.fhi != null && (
                <div style={{ margin: '6px 0' }}>
                  <div className="gauge-bar" style={{ height: 4 }}>
                    <div className="gauge-dot" style={{ left: `${zone.fhi}%`, width: 10, height: 10, background: getStatusColor(zone.fhi) }}/>
                  </div>
                </div>
              )}
              <div className="zone-card-stats">
                NDVI: {zone.signals?.ndvi ?? '—'}% • Thermal: {zone.fire?.count ?? '—'} • Bio: {zone.signals?.biodiversity ?? '—'}%
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(34,169,92,0.1)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>🌡 {zone.weather?.temp ?? '—'}°C</span>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>💧 {zone.weather?.humidity ?? '—'}%</span>
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(14,165,140,0.1)', color: '#6B8872', fontFamily: 'var(--font-mono)' }}>🐦 {zone.species?.birdSpecies ?? '—'} spp</span>
              </div>
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
            <span style={{ fontSize: 11, color: '#9DB8A2' }}>Draw on map</span>
          </div>
        </div>
      )}

      {/* ── Delete modal ──────────────────────────────────────────────── */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(26,46,30,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 360, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Delete zone?</div>
            <div style={{ fontSize: 13, color: '#6B8872', marginBottom: 20, lineHeight: 1.6 }}>
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