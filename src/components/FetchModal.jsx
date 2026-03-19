/**
 * FetchModal — VanDrishti
 *
 * The single entry point for fetching live data from all APIs.
 * Shows real-time per-zone, per-API progress.
 * Saves result to localStorage cache (read by all hooks).
 * Exports JSON for Raspberry Pi hosting.
 *
 * Usage:
 *   <FetchModal open={open} onClose={() => setOpen(false)} />
 *
 * The modal auto-opens on app load when cache is stale (controlled by App.jsx).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download, RefreshCw, CheckCircle, AlertCircle, Loader, Wifi, Server } from 'lucide-react'
import { fetchAndCacheAll, downloadCacheJson, getCacheMeta, getSettings } from '../services/dataCache'
import { notifyCacheUpdated } from '../hooks/useZoneData'

// ---------------------------------------------------------------------------
// API labels shown in progress rows
// ---------------------------------------------------------------------------
const API_LABELS = {
  ndvi:      { label: 'NDVI',         source: 'Copernicus',     color: '#22A95C' },
  fire:      { label: 'Fire events',  source: 'NASA FIRMS',     color: '#DC3545' },
  species:   { label: 'Species',      source: 'GBIF',           color: '#0EA58C' },
  birds:     { label: 'Birds',        source: 'eBird',          color: '#3B82F6' },
  weather:   { label: 'Weather',      source: 'OpenWeatherMap', color: '#60A5FA' },
  treeCover: { label: 'Tree cover',   source: 'Copernicus',     color: '#16A34A' },
}

function StatusIcon({ status, size = 14 }) {
  if (status === 'fetching') return <Loader size={size} style={{ color: '#D97706', animation: 'spin 1s linear infinite' }}/>
  if (status === 'success')  return <CheckCircle size={size} style={{ color: '#22A95C' }}/>
  if (status === 'mock')     return <CheckCircle size={size} style={{ color: '#D97706' }}/>
  if (status === 'error')    return <AlertCircle size={size} style={{ color: '#DC3545' }}/>
  return <div style={{ width: size, height: size, borderRadius: '50%', background: '#E0E8E2' }}/>
}

function ZoneProgressRow({ zone }) {
  const { name, status, fhi, dataSource } = zone
  const color = status === 'success' ? '#22A95C' : status === 'error' ? '#DC3545' : '#D97706'

  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #F0F5F1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <StatusIcon status={status} size={13}/>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#1A2E1E' }}>{name}</span>
        {fhi != null && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700, color, marginLeft: 'auto' }}>
            FHI {fhi}
          </span>
        )}
        {status === 'fetching' && (
          <span style={{ fontSize: 10, color: '#D97706', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
            querying APIs…
          </span>
        )}
      </div>

      {dataSource && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 21 }}>
          {Object.entries(dataSource).map(([key, src]) => {
            const meta = API_LABELS[key]
            const isLive = src !== 'mock'
            return (
              <span key={key} style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 20, fontFamily: 'JetBrains Mono, monospace',
                background: isLive ? 'rgba(34,169,92,0.12)' : 'rgba(217,119,6,0.12)',
                color: isLive ? '#16834A' : '#B45309',
                fontWeight: 600,
              }}>
                {meta?.source ?? key} {isLive ? '✓' : '~'}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function FetchModal({ open, onClose, autoFetch = false }) {
  const [phase, setPhase]         = useState('idle')    // idle | fetching | done | error
  const [zoneProgress, setZoneProgress] = useState({})  // zoneId → {name, status, fhi, dataSource}
  const [totalZones, setTotalZones] = useState(0)
  const [meta, setMeta]           = useState(null)
  const [errorMsg, setErrorMsg]   = useState('')
  const [showJson, setShowJson]   = useState(false)
  const [jsonPreview, setJsonPreview] = useState('')
  const scrollRef = useRef(null)
  const settings  = getSettings()

  const startFetch = useCallback(async () => {
    setPhase('fetching')
    setZoneProgress({})
    setErrorMsg('')
    setMeta(null)
    setShowJson(false)

    try {
      await fetchAndCacheAll((event) => {
        if (event.stage === 'start') {
          setTotalZones(event.total)
        } else if (event.stage === 'zone') {
          setZoneProgress(prev => ({
            ...prev,
            [event.zoneId]: {
              name:       event.zoneName,
              status:     event.status,
              fhi:        event.fhi,
              dataSource: event.dataSource,
            },
          }))
        } else if (event.stage === 'done') {
          setMeta(event.meta)
          setPhase('done')
          // Build JSON preview (truncated for display)
          const json = JSON.stringify(event.result, null, 2)
          setJsonPreview(json.length > 4000 ? json.slice(0, 4000) + '\n\n// … truncated' : json)
          // Notify all hooks that cache is fresh
          notifyCacheUpdated()
        } else if (event.stage === 'error') {
          setErrorMsg(event.error)
          setPhase('error')
        }
      })
    } catch (err) {
      setErrorMsg(err.message)
      setPhase('error')
    }
  }, [])

  // Auto-fetch when modal opens if requested
  useEffect(() => {
    if (open && autoFetch && phase === 'idle') {
      startFetch()
    }
  }, [open, autoFetch, phase, startFetch])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setPhase('idle')
      setZoneProgress({})
      setShowJson(false)
    }
  }, [open])

  // Scroll progress into view
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [zoneProgress])

  if (!open) return null

  const doneCount = Object.values(zoneProgress).filter(z => z.status === 'success').length
  const liveCount = Object.values(zoneProgress)
    .filter(z => z.dataSource)
    .reduce((n, z) => n + Object.values(z.dataSource).filter(s => s !== 'mock').length, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(26,46,30,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 20,
        width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #F0F5F1', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wifi size={18} color="#22A95C"/>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#1A2E1E' }}>Data Fetch</div>
                <div style={{ fontSize: 11, color: '#6B8872', fontFamily: 'JetBrains Mono, monospace' }}>
                  {phase === 'idle'     && 'Ready to fetch from all APIs'}
                  {phase === 'fetching' && `Querying ${totalZones} zones…`}
                  {phase === 'done'     && `Completed · ${new Date(meta?.fetchedAt).toLocaleTimeString()}`}
                  {phase === 'error'    && 'Fetch failed'}
                </div>
              </div>
            </div>
            {(phase === 'done' || phase === 'idle') && (
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B8872', padding: 4 }}>
                <X size={20}/>
              </button>
            )}
          </div>

          {/* Progress bar */}
          {(phase === 'fetching' || phase === 'done') && totalZones > 0 && (
            <div style={{ marginTop: 14, height: 4, background: '#F0F5F1', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 2,
                background: phase === 'done' ? '#22A95C' : 'linear-gradient(90deg, #22A95C, #D97706)',
                width: `${(doneCount / totalZones) * 100}%`,
                transition: 'width 0.4s ease',
              }}/>
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }} ref={scrollRef}>

          {/* Idle state */}
          {phase === 'idle' && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🛰️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A2E1E', marginBottom: 8 }}>
                Fetch live forest data
              </div>
              <div style={{ fontSize: 13, color: '#6B8872', lineHeight: 1.7, marginBottom: 20, maxWidth: 380, margin: '0 auto 20px' }}>
                Queries Copernicus, NASA FIRMS, GBIF, eBird, OpenWeatherMap, and OSM for all monitored zones. Results are cached locally.
              </div>

              {/* Last fetch info */}
              {getCacheMeta() && (() => {
                const m = getCacheMeta()
                const age = Math.round((Date.now() - new Date(m.fetchedAt).getTime()) / 60_000)
                return (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#F8FBF9', borderRadius: 8, padding: '8px 14px', marginBottom: 20, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#6B8872' }}>
                    <CheckCircle size={12} color="#22A95C"/>
                    Last fetch: {age < 1 ? 'just now' : `${age} min ago`} · {m.zoneCount} zones
                  </div>
                )
              })()}

              {/* API coverage pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
                {Object.values(API_LABELS).map(a => (
                  <span key={a.source} style={{ fontSize: 10, padding: '3px 10px', borderRadius: 20, background: `${a.color}18`, color: a.color, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {a.source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Zone progress rows */}
          {(phase === 'fetching' || phase === 'done') && (
            <div style={{ padding: '4px 0' }}>
              {Object.entries(zoneProgress).map(([id, zone]) => (
                <ZoneProgressRow key={id} zone={zone}/>
              ))}
              {phase === 'fetching' && Object.keys(zoneProgress).length === 0 && (
                <div style={{ padding: '20px 0', color: '#6B8872', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: '#D97706' }}/>
                  Initialising API connections…
                </div>
              )}
            </div>
          )}

          {/* Done summary */}
          {phase === 'done' && meta && (
            <div style={{ padding: '16px 0', borderTop: '1px solid #F0F5F1', marginTop: 4 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 120, background: '#F8FBF9', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#22A95C', fontFamily: 'JetBrains Mono, monospace' }}>{doneCount}</div>
                  <div style={{ fontSize: 11, color: '#6B8872' }}>Zones fetched</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, background: '#F8FBF9', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#22A95C', fontFamily: 'JetBrains Mono, monospace' }}>{liveCount}</div>
                  <div style={{ fontSize: 11, color: '#6B8872' }}>Live API readings</div>
                </div>
                <div style={{ flex: 1, minWidth: 120, background: '#F8FBF9', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1A2E1E', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(meta.fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B8872' }}>Fetched at</div>
                </div>
              </div>

              {/* RPi info */}
              {settings.rpiMode && (
                <div style={{ background: '#1A2E1E', borderRadius: 10, padding: '14px 16px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <Server size={18} color="#7ED9A0" style={{ flexShrink: 0, marginTop: 1 }}/>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: '#7ED9A0', marginBottom: 4 }}>Raspberry Pi Mode</div>
                    <div style={{ fontSize: 11, color: '#9DB8A2', lineHeight: 1.7, fontFamily: 'JetBrains Mono, monospace' }}>
                      Export this JSON and place it at <code style={{ color: '#7ED9A0' }}>/var/www/vandrishti/data.json</code> on your RPi.
                      The app can then fetch from <code style={{ color: '#7ED9A0' }}>http://&lt;rpi-ip&gt;/data.json</code> instead of live APIs.
                    </div>
                  </div>
                </div>
              )}

              {/* JSON preview toggle */}
              <button
                onClick={() => setShowJson(v => !v)}
                style={{ fontSize: 12, color: '#6B8872', background: 'none', border: '1px solid #E0E8E2', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', marginBottom: showJson ? 8 : 0 }}
              >
                {showJson ? '▾ Hide JSON' : '▸ Preview JSON'}
              </button>
              {showJson && (
                <pre style={{
                  background: '#1A2E1E', color: '#7ED9A0', borderRadius: 10, padding: 14,
                  fontSize: 10, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6,
                  overflowX: 'auto', maxHeight: 260, overflowY: 'auto',
                  border: 'none', margin: 0,
                }}>
                  {jsonPreview}
                </pre>
              )}
            </div>
          )}

          {/* Error state */}
          {phase === 'error' && (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <AlertCircle size={36} color="#DC3545" style={{ marginBottom: 12 }}/>
              <div style={{ fontWeight: 600, color: '#DC3545', marginBottom: 6 }}>Fetch failed</div>
              <div style={{ fontSize: 12, color: '#6B8872', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>{errorMsg}</div>
              <div style={{ fontSize: 12, color: '#6B8872' }}>Existing cached data will be used if available.</div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F0F5F1', flexShrink: 0, display: 'flex', gap: 8, alignItems: 'center' }}>

          {phase === 'idle' && (
            <>
              <button onClick={startFetch} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#1A2E1E', color: '#7ED9A0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, sans-serif' }}>
                <RefreshCw size={14}/> Fetch Now
              </button>
              <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, background: 'transparent', color: '#6B8872', border: '1px solid #E0E8E2', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Use Cached
              </button>
            </>
          )}

          {phase === 'fetching' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, color: '#6B8872', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: '#D97706' }}/>
              Fetching… do not close this window
            </div>
          )}

          {phase === 'done' && (
            <>
              <button onClick={downloadCacheJson} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F0F5F1', color: '#3A5A40', border: '1px solid #D4E4D8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}>
                <Download size={13}/> Export JSON
              </button>
              <button onClick={startFetch} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F0F5F1', color: '#3A5A40', border: '1px solid #D4E4D8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif' }}>
                <RefreshCw size={13}/> Fetch Again
              </button>
              <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#1A2E1E', color: '#7ED9A0', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Done
              </button>
            </>
          )}

          {phase === 'error' && (
            <>
              <button onClick={startFetch} style={{ flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, background: '#1A2E1E', color: '#7ED9A0', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'Inter, sans-serif' }}>
                <RefreshCw size={14}/> Retry
              </button>
              <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, fontSize: 13, background: 'transparent', color: '#6B8872', border: '1px solid #E0E8E2', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                Use Cache
              </button>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
