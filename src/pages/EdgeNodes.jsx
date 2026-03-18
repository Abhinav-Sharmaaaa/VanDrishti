import { useState, useEffect, useRef } from 'react'
import { Cpu, Wifi, Plus, CheckCircle, Download } from 'lucide-react'

const terminalLines = [
  { ts: '14:22:01', msg: 'Polling NASA FIRMS API...' },
  { ts: '14:22:03', msg: 'Thermal anomalies found: 7' },
  { ts: '14:22:04', msg: 'Polling GBIF for zone bbox...' },
  { ts: '14:22:06', msg: 'Species count: 43 (-12% from baseline)' },
  { ts: '14:22:07', msg: 'Polling OpenWeatherMap...' },
  { ts: '14:22:08', msg: 'Temp: 34.2°C | Humidity: 28% | Rain: 0mm' },
  { ts: '14:22:09', msg: 'Computing micro-FHI...' },
  { ts: '14:22:09', msg: 'micro-FHI = 38 [WATCH]', highlight: true },
  { ts: '14:22:10', msg: 'POST http://192.168.1.10:8000/api/ground' },
  { ts: '14:22:10', msg: '200 OK — heartbeat accepted', success: true },
  { ts: '14:22:10', msg: 'Sleeping 300s until next cycle...' },
]

const sparkData = [52, 48, 45, 50, 47, 44, 42, 46, 40, 38, 41, 39, 36, 38, 42, 40, 38, 35, 37, 38, 36, 38, 40, 38]

function Sparkline({ data, color }) {
  return (
    <div className="sparkline-placeholder">
      {data.map((v, i) => (
        <div key={i} className="bar"
          style={{
            height: `${(v / 70) * 100}%`,
            background: i >= data.length - 6 ? '#F59E0B' : color || '#2ECC71',
            opacity: i >= data.length - 6 ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  )
}

export default function EdgeNodes() {
  const [visibleLines, setVisibleLines] = useState(0)
  const termRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleLines(prev => {
        if (prev >= terminalLines.length) return prev
        return prev + 1
      })
    }, 400)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [visibleLines])

  return (
    <>
      <div className="top-bar">
        <div>
          <h1 className="page-title">Edge Intelligence Nodes</h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>Raspberry Pi ground-truth monitoring network</p>
        </div>
        <div className="top-bar-right">
          <button className="btn btn-primary"><Plus size={14}/>Register Node</button>
        </div>
      </div>

      {/* Node Card */}
      <div className="node-card">
        <div className="node-card-header">
          <div className="node-card-left">
            <Cpu size={20} color="#6B8F72" />
            <span className="node-card-name">Node RPi-001</span>
            <span className="pulse-dot"></span>
            <span className="online-tag">ONLINE</span>
          </div>
          <div>
            <span className="text-muted" style={{ fontSize: 12, marginRight: 6 }}>Micro-FHI:</span>
            <span className="mono text-amber" style={{ fontSize: 22, fontWeight: 700 }}>38</span>
          </div>
        </div>

        <div className="node-card-body">
          <div>
            <div className="node-info-row">
              <span className="node-info-label">Last sync</span>
              <span className="node-info-value text-green">2 min ago</span>
            </div>
            <div className="node-info-row">
              <span className="node-info-label">Zone assigned</span>
              <span className="node-info-value">Corbett-A</span>
            </div>
            <div className="node-info-row">
              <span className="node-info-label">Uptime</span>
              <span className="node-info-value">14h 22m</span>
            </div>
            <div className="node-info-row">
              <span className="node-info-label">Buffer status</span>
              <span className="node-info-value text-green">Synced — 0 pending</span>
            </div>
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: 8 }}>Last 24h Micro-FHI</div>
            <Sparkline data={sparkData} />
          </div>
        </div>

        <div className="node-card-bottom">
          <div className="signal-agreement">
            <span className="badge badge-healthy" style={{ padding: '4px 12px' }}>
              <CheckCircle size={12} /> Signal Agreement: CONFIRMED
            </span>
          </div>
          <p className="signal-explanation">
            RPi micro-FHI (38) confirms satellite FHI (42) — alert validated
          </p>
          <div className="metrics-pills">
            <span className="metric-pill">NASA FIRMS ✓</span>
            <span className="metric-pill">GBIF ✓</span>
            <span className="metric-pill">OpenWeather ✓</span>
            <span className="metric-pill">SQLite buffer: 0</span>
          </div>
        </div>
      </div>

      {/* Register New Node Card */}
      <div className="register-node-card">
        <div style={{ display: 'flex', gap: 12, opacity: 0.4 }}>
          <Cpu size={28} />
          <Wifi size={28} />
        </div>
        <div className="register-node-title">Register new edge node</div>
        <div className="register-node-desc">
          Deploy a Raspberry Pi to any forest zone in under 10 minutes
        </div>
        <button className="btn btn-primary"><Plus size={14}/>Register Node</button>
      </div>

      {/* Live Terminal */}
      <div className="terminal-card">
        <div className="terminal-header">
          <div className="terminal-dots">
            <span></span><span></span><span></span>
          </div>
          <span className="terminal-title">rpi-agent — live log</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '3px 8px' }}>
            <Download size={12}/>Download Log
          </button>
        </div>
        <div className="terminal-body" ref={termRef}>
          {terminalLines.slice(0, visibleLines).map((line, i) => (
            <div key={i} className="terminal-line" style={{
              color: line.highlight ? '#F59E0B' : line.success ? '#2ECC71' : undefined,
            }}>
              <span className="ts">[{line.ts}]</span> {line.msg}
            </div>
          ))}
          {visibleLines >= terminalLines.length && (
            <div className="terminal-line">
              <span className="terminal-cursor"></span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
