import { useState, useEffect, useRef } from 'react'
import { Cpu, Wifi, WifiOff, RefreshCw, Activity, Database } from 'lucide-react'
import { useEdgeData } from '../hooks/useEdgeData'

// Status color map — same as dataService.js
const STATUS_COLOR = {
  healthy:  '#22A95C',
  watch:    '#D97706',
  alert:    '#EA580C',
  critical: '#DC3545',
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] ?? '#888'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 11,
      fontWeight: 600, fontFamily: 'var(--font-mono)',
      background: color + '18', color,
    }}>
      {status?.toUpperCase()}
    </span>
  )
}

function SignalBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3,
                    background: 'var(--color-border-tertiary)' }}>
        <div style={{ height: '100%', borderRadius: 3, width: `${value}%`,
                      background: color, transition: 'width 0.6s ease' }}/>
      </div>
    </div>
  )
}

function SourcePill({ label, source }) {
  const isLive = source !== 'mock'
  return (
    <span style={{
      fontSize: 9, padding: '2px 8px', borderRadius: 10,
      fontFamily: 'var(--font-mono)', fontWeight: 600,
      background: isLive ? 'rgba(34,169,92,0.12)' : 'rgba(217,119,6,0.12)',
      color: isLive ? '#16834A' : '#B45309',
    }}>
      {label}: {source}
    </span>
  )
}

// Terminal log — generated from real snapshot
function TerminalLog({ snapshot }) {
  const [lines, setLines] = useState([])
  const termRef = useRef(null)

  useEffect(() => {
    if (!snapshot) return
    const s   = snapshot
    const now = new Date().toTimeString().slice(0, 8)
    const newLines = [
      { ts: now, msg: `Zone: ${s.name} (${s.id})` },
      { ts: now, msg: `Fetching OpenWeatherMap…` },
      { ts: now, msg: `Temp: ${s.weather.temp}°C | Humidity: ${s.weather.humidity}% | Rain: ${s.weather.rainfall}mm` },
      { ts: now, msg: `Fetching NASA FIRMS…` },
      { ts: now, msg: `Thermal anomalies: ${s.fire.count}` },
      { ts: now, msg: `Fetching GBIF species count…` },
      { ts: now, msg: `Species count: ${s.species.count}` },
      { ts: now, msg: `Fetching eBird activity…` },
      { ts: now, msg: `Bird species observed: ${s.species.birdSpecies}` },
      { ts: now, msg: `Fetching Copernicus NDVI…` },
      { ts: now, msg: `NDVI: ${s.signals.ndvi}` },
      { ts: now, msg: `Computing FHI…` },
      {
        ts: now,
        msg: `FHI = ${s.fhi} [${s.status.toUpperCase()}]`,
        highlight: true,
      },
      { ts: now, msg: `POST ${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/ingest` },
      { ts: now, msg: `200 OK — snapshot accepted`, success: true },
      { ts: now, msg: `Next cycle in ${Math.round((parseInt(import.meta.env.VITE_FETCH_INTERVAL_SEC || '300')) / 60)} min…` },
    ]
    setLines(newLines)
  }, [snapshot])

  useEffect(() => {
    if (termRef.current)
      termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  return (
    <div className="terminal-card">
      <div className="terminal-header">
        <div className="terminal-dots">
          <span/><span/><span/>
        </div>
        <span className="terminal-title">rpi-agent — live log</span>
      </div>
      <div className="terminal-body" ref={termRef}>
        {lines.map((l, i) => (
          <div key={i} className="terminal-line" style={{
            color: l.highlight ? '#F59E0B' : l.success ? '#2ECC71' : undefined,
          }}>
            <span className="ts">[{l.ts}]</span> {l.msg}
          </div>
        ))}
        {lines.length > 0 && (
          <div className="terminal-line">
            <span className="terminal-cursor"/>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EdgeNodes() {
  const { snapshots, devices, connected, lastSyncLabel } = useEdgeData()
  const snapshotList = Object.values(snapshots)

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">Edge Intelligence Nodes</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
            Raspberry Pi ground-truth monitoring network
          </p>
        </div>
        <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* WebSocket status */}
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            display: 'flex', alignItems: 'center', gap: 6,
            color: connected ? '#22A95C' : '#D97706',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#22A95C' : '#D97706',
              display: 'inline-block',
              animation: connected ? 'pulse 2s infinite' : 'none',
            }}/>
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
      </div>

      {/* No nodes yet */}
      {snapshotList.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Cpu size={36} style={{ opacity: 0.3, marginBottom: 12 }}/>
          <p style={{ color: 'var(--text-secondary)' }}>
            No RPi nodes connected yet.<br/>
            Start <code>python src/main.py</code> on your Raspberry Pi.
          </p>
        </div>
      )}

      {/* One card per connected zone */}
      {snapshotList.map(snap => {
        const statusColor = STATUS_COLOR[snap.status] ?? '#888'
        const sig = snap.signals

        return (
          <div key={snap.id} className="node-card" style={{ marginBottom: 20 }}>
            <div className="node-card-header">
              <div className="node-card-left">
                <Cpu size={20} color="#6B8F72"/>
                <span className="node-card-name">{snap.deviceId}</span>
                <span className="pulse-dot"/>
                <span className="online-tag">ONLINE</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <StatusBadge status={snap.status}/>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 4 }}>
                    FHI
                  </span>
                  <span style={{ fontSize: 22, fontWeight: 700,
                                 fontFamily: 'var(--font-mono)', color: statusColor }}>
                    {snap.fhi}
                  </span>
                </div>
              </div>
            </div>

            <div className="node-card-body">
              {/* Left — zone info + signals */}
              <div>
                <div className="node-info-row">
                  <span className="node-info-label">Zone</span>
                  <span className="node-info-value">{snap.name}</span>
                </div>
                <div className="node-info-row">
                  <span className="node-info-label">Last sync</span>
                  <span className="node-info-value text-green">{lastSyncLabel}</span>
                </div>
                <div className="node-info-row">
                  <span className="node-info-label">Fire events</span>
                  <span className="node-info-value" style={{
                    color: snap.fire.count > 5 ? '#DC3545' : 'inherit'
                  }}>
                    {snap.fire.count} detected
                  </span>
                </div>
                <div className="node-info-row">
                  <span className="node-info-label">Weather</span>
                  <span className="node-info-value">
                    {snap.weather.temp}°C · {snap.weather.humidity}% humidity
                  </span>
                </div>
                <div className="node-info-row">
                  <span className="node-info-label">Species</span>
                  <span className="node-info-value">{snap.species.count} (GBIF)</span>
                </div>
                <div className="node-info-row">
                  <span className="node-info-label">Bird species</span>
                  <span className="node-info-value">{snap.species.birdSpecies} (eBird)</span>
                </div>
              </div>

              {/* Right — signal bars */}
              <div>
                <div className="card-title" style={{ marginBottom: 12 }}>Signal breakdown</div>
                <SignalBar label="NDVI"         value={sig.ndvi}         color="#22A95C"/>
                <SignalBar label="Biodiversity" value={sig.biodiversity}  color="#0EA58C"/>
                <SignalBar label="Moisture"     value={sig.moisture}      color="#3B82F6"/>
                <SignalBar label="Cover health" value={sig.coverHealth}   color="#8B5CF6"/>
                <SignalBar
                  label="Thermal risk"
                  value={sig.thermalRisk}
                  color={sig.thermalRisk > 50 ? '#DC3545' : '#D97706'}
                />
              </div>
            </div>

            {/* Data source pills */}
            <div className="node-card-bottom">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                {Object.entries(snap.dataSource).map(([k, v]) => (
                  <SourcePill key={k} label={k} source={v}/>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Updated: {snap.lastUpdated?.slice(0, 19).replace('T', ' ')} UTC
              </p>
            </div>
          </div>
        )
      })}

      {/* Terminal — shows last received snapshot log */}
      {snapshotList.length > 0 && (
        <TerminalLog snapshot={snapshotList[0]}/>
      )}
    </>
  )
}
