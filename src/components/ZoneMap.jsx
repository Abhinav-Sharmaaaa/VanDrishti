/**
 * ZoneMap — Real Leaflet map with NDVI visualization
 * Save to: src/components/ZoneMap.jsx
 *
 * Requires in src/main.jsx (before your own CSS):
 *   import 'leaflet/dist/leaflet.css'
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  MapContainer, TileLayer, LayersControl,
  Rectangle, Popup, Tooltip, useMap, useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ---------------------------------------------------------------------------
// Color scales
// ---------------------------------------------------------------------------
const STATUS_COLORS = {
  healthy:  { fill: '#22A95C', stroke: '#16834A' },
  watch:    { fill: '#D97706', stroke: '#B45309' },
  alert:    { fill: '#EA580C', stroke: '#C2410C' },
  critical: { fill: '#DC3545', stroke: '#B91C1C' },
  pending:  { fill: '#6B8872', stroke: '#4B6B55' },
}

function ndviColor(ndvi) {
  if (ndvi == null) return { fill: '#6B8872', stroke: '#4B6B55' }
  if (ndvi >= 75)  return { fill: '#15803D', stroke: '#166534' }
  if (ndvi >= 60)  return { fill: '#22A95C', stroke: '#16834A' }
  if (ndvi >= 45)  return { fill: '#84CC16', stroke: '#4D7C0F' }
  if (ndvi >= 30)  return { fill: '#D97706', stroke: '#B45309' }
  if (ndvi >= 15)  return { fill: '#EA580C', stroke: '#C2410C' }
  return               { fill: '#DC3545', stroke: '#B91C1C' }
}

// ---------------------------------------------------------------------------
// Two-click rectangle draw
// ---------------------------------------------------------------------------
function DrawHandler({ active, onComplete }) {
  const map = useMap()
  const cornerA = useRef(null)
  const preview = useRef(null)

  useEffect(() => {
    map.getContainer().style.cursor = active ? 'crosshair' : ''
    if (!active) {
      cornerA.current = null
      if (preview.current) { map.removeLayer(preview.current); preview.current = null }
    }
    return () => { map.getContainer().style.cursor = '' }
  }, [active, map])

  useMapEvents({
    click(e) {
      if (!active) return
      if (!cornerA.current) {
        cornerA.current = e.latlng
      } else {
        const bounds = L.latLngBounds(cornerA.current, e.latlng)
        cornerA.current = null
        if (preview.current) { map.removeLayer(preview.current); preview.current = null }
        onComplete(bounds)
      }
    },
    mousemove(e) {
      if (!active || !cornerA.current) return
      const bounds = L.latLngBounds(cornerA.current, e.latlng)
      if (preview.current) {
        preview.current.setBounds(bounds)
      } else {
        preview.current = L.rectangle(bounds, {
          color: '#22A95C', fillColor: '#22A95C',
          fillOpacity: 0.15, weight: 1.5, dashArray: '6 3',
        }).addTo(map)
      }
    },
  })
  return null
}

// ---------------------------------------------------------------------------
// Fly to — supports both a lat/lon point (search) and a bbox (zone click)
// ---------------------------------------------------------------------------
function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if (target.bbox) {
      // Zoom to fit the zone bounding box with comfortable padding
      map.fitBounds(
        [[target.bbox.minLat, target.bbox.minLon], [target.bbox.maxLat, target.bbox.maxLon]],
        { padding: [48, 48], maxZoom: 13, duration: 1.2 }
      )
    } else {
      map.flyTo([target.lat, target.lon], 9, { duration: 1.2 })
    }
  }, [target, map])
  return null
}

// ---------------------------------------------------------------------------
// Zone overlays
// ---------------------------------------------------------------------------
function ZoneOverlay({ zones, selectedId, onZoneClick, colorMode }) {
  return zones.map(zone => {
    if (!zone.bbox) return null
    const c = colorMode === 'ndvi'
      ? ndviColor(zone.signals?.ndvi)
      : (STATUS_COLORS[zone.status] || STATUS_COLORS.pending)
    const sel = zone.id === selectedId

    return (
      <Rectangle
        key={zone.id}
        bounds={[[zone.bbox.minLat, zone.bbox.minLon], [zone.bbox.maxLat, zone.bbox.maxLon]]}
        pathOptions={{
          color: c.stroke,
          fillColor: c.fill,
          fillOpacity: sel ? 0.55 : 0.35,
          weight: sel ? 3 : 1.5,
          dashArray: zone.status === 'pending' ? '6 4' : undefined,
        }}
        eventHandlers={{
          click: () => onZoneClick(zone.id),
        }}
      >
        <Tooltip className="vandrishti-popup" direction="top" sticky>
          <div style={{ minWidth: 180, fontFamily: 'Inter, sans-serif', padding: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1A2E1E', marginBottom: 8 }}>{zone.name}</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                background: `${c.fill}22`, color: c.stroke,
                fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: 1,
              }}>{zone.status}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700, color: c.fill, lineHeight: 1 }}>
                {zone.fhi ?? '—'}
              </span>
              <span style={{ fontSize: 10, color: '#6B8872' }}>FHI</span>
            </div>

            {zone.signals && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  ['NDVI', zone.signals.ndvi, '#22A95C'],
                  ['Biodiversity', zone.signals.biodiversity, '#0EA58C'],
                  ['Moisture', zone.signals.moisture, '#3B82F6'],
                  ['Thermal Risk', zone.signals.thermalRisk, '#DC3545'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: '#6B8872', width: 72, fontFamily: 'JetBrains Mono, monospace' }}>{label}</span>
                    <div style={{ flex: 1, height: 4, background: '#E8F1EA', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${val ?? 0}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }}/>
                    </div>
                    <span style={{ fontSize: 9, color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, width: 28, textAlign: 'right' }}>{val ?? '—'}%</span>
                  </div>
                ))}
              </div>
            )}

            {zone.weather && (
              <div style={{ marginTop: 8, padding: '6px 8px', background: '#F8FBF9', borderRadius: 6, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#6B8872', display: 'flex', gap: 10 }}>
                <span>🌡 {zone.weather.temp}°C</span>
                <span>💧 {zone.weather.humidity}%</span>
                <span>🔥 {zone.fire?.count ?? 0} events</span>
              </div>
            )}

            {zone.placeName && (
              <div style={{ fontSize: 10, color: '#9DB8A2', marginTop: 6 }}>{zone.placeName}</div>
            )}
          </div>
        </Tooltip>
      </Rectangle>
    )
  })
}

// ---------------------------------------------------------------------------
// Search bar (Nominatim)
// ---------------------------------------------------------------------------
function SearchBar({ onResult }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy]       = useState(false)
  const timer = useRef(null)

  const doSearch = useCallback(async (q) => {
    if (q.length < 3) { setResults([]); return }
    setBusy(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: 'json', limit: 6 })}`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'VanDrishti/1.0' } }
      )
      const data = await res.json()
      setResults(data.map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon), bbox: r.boundingbox })))
    } catch { setResults([]) }
    setBusy(false)
  }, [])

  return (
    <div style={{ position: 'relative', zIndex: 10000 }}>
      <div style={{ position: 'relative' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6B8872', pointerEvents: 'none' }}>
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <line x1="9.5" y1="9.5" x2="13" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); clearTimeout(timer.current); timer.current = setTimeout(() => doSearch(e.target.value), 400) }}
          placeholder="Search forest, reserve…"
          style={{
            paddingLeft: 32, paddingRight: busy ? 28 : 10, height: 34, width: 240,
            border: '1.5px solid rgba(212,228,216,0.9)', borderRadius: 8,
            fontFamily: 'Inter, sans-serif', fontSize: 12,
            background: 'rgba(255,255,255,0.95)', color: '#1A2E1E', outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        />
        {busy && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#6B8872' }}>…</span>}
      </div>
      {results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, width: 300, marginTop: 4,
          background: '#fff', border: '1.5px solid #D4E4D8', borderRadius: 8,
          boxShadow: '0 6px 24px rgba(0,0,0,0.14)', overflow: 'hidden',
        }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => { setQuery(r.label.split(',').slice(0,2).join(', ')); setResults([]); onResult(r) }}
              style={{ padding: '9px 12px', fontSize: 12, cursor: 'pointer', color: '#1A2E1E', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, borderBottom: i < results.length-1 ? '1px solid #F0F5F1' : 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FBF9'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              {r.label.split(',').slice(0,3).join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NDVI Legend
// ---------------------------------------------------------------------------
function NdviLegend() {
  const steps = [
    { label: '75–100', color: '#15803D' },
    { label: '60–75',  color: '#22A95C' },
    { label: '45–60',  color: '#84CC16' },
    { label: '30–45',  color: '#D97706' },
    { label: '15–30',  color: '#EA580C' },
    { label: '0–15',   color: '#DC3545' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B6B55', marginBottom: 2, letterSpacing: 0.5, fontFamily: 'JetBrains Mono, monospace' }}>NDVI</div>
      {steps.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: 'inline-block', flexShrink: 0 }}/>
          <span style={{ color: '#4B6B55', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function StatusLegend() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#4B6B55', marginBottom: 2, letterSpacing: 0.5, fontFamily: 'JetBrains Mono, monospace' }}>STATUS</div>
      {Object.entries(STATUS_COLORS).map(([s, c]) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: c.fill, display: 'inline-block', flexShrink: 0 }}/>
          <span style={{ color: '#4B6B55', textTransform: 'capitalize', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}>{s}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function ZoneMap({
  zones        = [],
  selectedZoneId = null,
  onZoneClick  = () => {},
  onZoneAdded  = () => {},
  height       = 500,
  showDraw     = true,        // hide draw tools on dashboard
  showSearch   = true,
  defaultColorMode = 'status', // 'status' | 'ndvi'
}) {
  const [colorMode, setColorMode]     = useState(defaultColorMode)
  const [drawActive, setDrawActive]   = useState(false)
  const [drawnBounds, setDrawnBounds] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [zoneName, setZoneName]       = useState('')
  const [nameError, setNameError]     = useState('')
  const [flyTarget, setFlyTarget]     = useState(null)
  const nameRef = useRef(null)

  // Zoom to selected zone whenever selectedZoneId changes
  useEffect(() => {
    if (!selectedZoneId) return
    const zone = zones.find(z => z.id === selectedZoneId)
    if (!zone) return
    if (zone.bbox) {
      setFlyTarget({ bbox: zone.bbox, _key: selectedZoneId })
    } else if (zone.lat != null && zone.lon != null) {
      setFlyTarget({ lat: zone.lat, lon: zone.lon, _key: selectedZoneId })
    }
  }, [selectedZoneId, zones])

  const handleDrawComplete = useCallback((bounds) => {
    setDrawnBounds(bounds); setDrawActive(false)
    setConfirmOpen(true); setZoneName(''); setNameError('')
    setTimeout(() => nameRef.current?.focus(), 80)
  }, [])

  const handleConfirm = () => {
    const name = zoneName.trim()
    if (!name) return setNameError('Zone name is required')
    if (zones.some(z => z.name.toLowerCase() === name.toLowerCase()))
      return setNameError('A zone with this name already exists')
    const id  = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const lat = (drawnBounds.getNorth() + drawnBounds.getSouth()) / 2
    const lon = (drawnBounds.getEast()  + drawnBounds.getWest())  / 2
    onZoneAdded({ id, name, lat, lon, bbox: { minLat: drawnBounds.getSouth(), maxLat: drawnBounds.getNorth(), minLon: drawnBounds.getWest(), maxLon: drawnBounds.getEast() }, coords: `${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E`, isoCode: 'IND', adminCode: '0' })
    setConfirmOpen(false); setDrawnBounds(null); setZoneName('')
  }

  const handleCancel = () => {
    setConfirmOpen(false); setDrawnBounds(null)
    setDrawActive(false); setZoneName(''); setNameError('')
  }

  const handleSearchResult = (r) => {
    setFlyTarget({ lat: r.lat, lon: r.lon })
    if (r.bbox && showDraw) {
      const [minLat, maxLat, minLon, maxLon] = r.bbox.map(Number)
      setDrawnBounds(L.latLngBounds([minLat, minLon], [maxLat, maxLon]))
      setConfirmOpen(true)
      setZoneName(r.label.split(',')[0].trim())
      setTimeout(() => nameRef.current?.focus(), 900)
    }
  }

  return (
    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid #D4E4D8', boxShadow: '0 4px 24px rgba(26,46,30,0.08)' }}>

      {/* ── Top toolbar ─────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, display: 'flex', gap: 8, alignItems: 'center' }}>
        {showSearch && <SearchBar onResult={handleSearchResult} />}

        {/* Color mode toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.95)', border: '1.5px solid rgba(212,228,216,0.9)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
          {[['status', 'Status'], ['ndvi', 'NDVI']].map(([mode, label]) => (
            <button key={mode} onClick={() => setColorMode(mode)} style={{
              padding: '0 12px', height: 34, fontSize: 11, fontWeight: colorMode === mode ? 700 : 500,
              cursor: 'pointer', border: 'none', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              background: colorMode === mode ? '#1A2E1E' : 'transparent',
              color: colorMode === mode ? '#7ED9A0' : '#6B8872',
            }}>{label}</button>
          ))}
        </div>

        {/* Draw button */}
        {showDraw && (
          <button onClick={() => { setDrawActive(a => !a); if (confirmOpen) handleCancel() }} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0 12px', height: 34, borderRadius: 8, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
            border: drawActive ? '1.5px solid #22A95C' : '1.5px solid rgba(212,228,216,0.9)',
            background: drawActive ? '#1A2E1E' : 'rgba(255,255,255,0.95)',
            color: drawActive ? '#7ED9A0' : '#3A5A40',
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)', fontFamily: 'Inter, sans-serif',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x=".5" y="2.5" width="11" height="7" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none"/>
            </svg>
            {drawActive ? 'Cancel' : 'Draw Zone'}
          </button>
        )}
      </div>

      {/* Draw hint */}
      {drawActive && (
        <div style={{
          position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#1A2E1E', color: '#7ED9A0',
          fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
          padding: '6px 16px', borderRadius: 20,
          boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          ● Click corner 1 → click corner 2 to finish
        </div>
      )}

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapContainer center={[24.5, 83.0]} zoom={5} style={{ height, width: '100%' }}>
        <FlyTo target={flyTarget} />
        <DrawHandler active={drawActive} onComplete={handleDrawComplete} />

        <LayersControl position="bottomleft">
          <LayersControl.BaseLayer checked name="Satellite">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Terrain">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={19}
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <ZoneOverlay zones={zones} selectedId={selectedZoneId} onZoneClick={onZoneClick} colorMode={colorMode} />

        {drawnBounds && (
          <Rectangle
            bounds={[[drawnBounds.getSouth(), drawnBounds.getWest()], [drawnBounds.getNorth(), drawnBounds.getEast()]]}
            pathOptions={{ color: '#22A95C', fillColor: '#22A95C', fillOpacity: 0.18, weight: 2, dashArray: confirmOpen ? undefined : '6 3' }}
          />
        )}
      </MapContainer>

      {/* ── Confirm panel ───────────────────────────────────────────── */}
      {confirmOpen && drawnBounds && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2000,
          background: 'rgba(255,255,255,0.98)', borderTop: '1px solid #D4E4D8',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 -4px 24px rgba(26,46,30,0.12)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#6B8872', lineHeight: 1.8, minWidth: 130 }}>
            <div style={{ color: '#22A95C', fontWeight: 700, marginBottom: 2 }}>📐 Selected area</div>
            <div>N {drawnBounds.getNorth().toFixed(3)}°  S {drawnBounds.getSouth().toFixed(3)}°</div>
            <div>W {drawnBounds.getWest().toFixed(3)}°  E {drawnBounds.getEast().toFixed(3)}°</div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#6B8872', fontFamily: 'JetBrains Mono, monospace', marginBottom: 4, letterSpacing: 0.5 }}>ZONE NAME</div>
            <input
              ref={nameRef}
              value={zoneName}
              onChange={e => { setZoneName(e.target.value); setNameError('') }}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') handleCancel() }}
              placeholder="e.g. Kaziranga North, Pench-A…"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: `1.5px solid ${nameError ? '#DC3545' : '#D4E4D8'}`,
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                background: '#F8FBF9', color: '#1A2E1E', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {nameError && <div style={{ fontSize: 11, color: '#DC3545', marginTop: 3 }}>{nameError}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCancel} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, background: 'transparent', color: '#6B8872', border: '1.5px solid #D4E4D8', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
            <button onClick={handleConfirm} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#1A2E1E', color: '#7ED9A0', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap' }}>
              Add Zone →
            </button>
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: confirmOpen ? 100 : 30, right: 12, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(212,228,216,0.9)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.10)', transition: 'bottom 0.2s',
      }}>
        {colorMode === 'ndvi' ? <NdviLegend /> : <StatusLegend />}
      </div>

      {/* Live pill */}
      <div style={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        background: 'rgba(26,46,30,0.85)', backdropFilter: 'blur(6px)',
        borderRadius: 20, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#7ED9A0', fontWeight: 700,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22A95C', display: 'inline-block', animation: 'pulse 1.5s infinite' }}/>
        LIVE
      </div>
    </div>
  )
}