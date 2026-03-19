/**
 * Settings — VanDrishti
 * Add route in App.jsx: <Route path="/settings" element={<Settings />} />
 */
import { useState } from 'react'
import { Save, RefreshCw, Trash2, Download, Server, Clock, Database, Wifi } from 'lucide-react'
import FetchModal from '../components/FetchModal'
import { getSettings, saveSettings, getCacheMeta, clearCache, downloadCacheJson, DEFAULT_SETTINGS } from '../services/dataCache'
import { notifyCacheUpdated, useCacheStatus } from '../hooks/useZoneData'

const INTERVAL_OPTIONS = [
  { value: 0,   label: 'Manual only' },
  { value: 5,   label: 'Every 5 minutes' },
  { value: 15,  label: 'Every 15 minutes' },
  { value: 30,  label: 'Every 30 minutes' },
  { value: 60,  label: 'Every hour' },
  { value: 120, label: 'Every 2 hours' },
  { value: 360, label: 'Every 6 hours' },
]

function SettingRow({ icon: Icon, title, description, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '18px 0', borderBottom: '1px solid #F0F5F1' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={16} color="#6B8872"/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#1A2E1E', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6B8872', lineHeight: 1.5 }}>{description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {children}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? '#1A2E1E' : '#D1D5DB', transition: 'background 0.2s', position: 'relative',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 22 : 2, width: 20, height: 20,
        borderRadius: '50%', background: value ? '#7ED9A0' : '#FFFFFF',
        transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}/>
    </button>
  )
}

export default function Settings() {
  const [settings, setLocalSettings] = useState(getSettings)
  const [saved, setSaved]            = useState(false)
  const [fetchOpen, setFetchOpen]    = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)
  const { meta, stale, ageMin }      = useCacheStatus()

  const update = (key, val) => setLocalSettings(prev => ({ ...prev, [key]: val }))

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearCache = () => {
    clearCache()
    notifyCacheUpdated()
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2000)
  }

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title">Settings</h1>
        <div className="top-bar-right">
          <button onClick={handleSave} className="btn btn-primary" style={{ gap: 6 }}>
            <Save size={14}/>{saved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Data Fetching ─────────────────────────────────────────── */}
        <div className="card" style={{ padding: '4px 20px 8px' }}>
          <div className="card-title" style={{ padding: '14px 0 4px', borderBottom: '1px solid #F0F5F1', marginBottom: 0 }}>
            Data Fetching
          </div>

          <SettingRow icon={Clock} title="Fetch interval" description="How often to automatically re-fetch live data. Set to 'Manual only' to fetch only when you click Fetch Now.">
            <select
              value={settings.fetchInterval}
              onChange={e => update('fetchInterval', Number(e.target.value))}
              className="input"
              style={{ width: 180 }}
            >
              {INTERVAL_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </SettingRow>

          <SettingRow icon={Wifi} title="Auto-fetch on load" description="Automatically open the fetch modal when the app loads and cached data is stale.">
            <Toggle value={settings.autoFetchOnLoad} onChange={v => update('autoFetchOnLoad', v)}/>
          </SettingRow>

          <SettingRow icon={RefreshCw} title="Fetch now" description="Manually trigger a full data refresh from all APIs.">
            <button onClick={() => setFetchOpen(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13}/> Fetch Now
            </button>
          </SettingRow>
        </div>

        {/* ── Cache Status ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: '4px 20px 8px' }}>
          <div className="card-title" style={{ padding: '14px 0 4px', borderBottom: '1px solid #F0F5F1', marginBottom: 0 }}>
            Cache
          </div>

          <SettingRow icon={Database} title="Cached data" description={
            meta
              ? `${meta.zoneCount} zones · Last fetched ${ageMin != null ? (ageMin < 1 ? 'just now' : `${ageMin} min ago`) : '—'} · ${stale ? '⚠ Stale' : '✓ Fresh'}`
              : 'No data cached yet. Click Fetch Now to load data.'
          }>
            <div style={{ display: 'flex', gap: 8 }}>
              {meta && (
                <button onClick={downloadCacheJson} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Download size={12}/> Export JSON
                </button>
              )}
              <button onClick={handleClearCache} className="btn btn-ghost btn-sm" style={{ color: '#DC3545', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Trash2 size={12}/> {cacheCleared ? 'Cleared ✓' : 'Clear'}
              </button>
            </div>
          </SettingRow>

          {meta?.sources && (
            <div style={{ paddingBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#6B8872', marginBottom: 8, fontFamily: 'var(--font-mono)' }}>DATA SOURCE STATUS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(meta.sources).map(([key, status]) => {
                  const isLive = status === 'live'
                  return (
                    <span key={key} style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      background: isLive ? 'rgba(34,169,92,0.12)' : 'rgba(217,119,6,0.12)',
                      color: isLive ? '#16834A' : '#B45309',
                    }}>
                      {key}: {status}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Raspberry Pi ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: '4px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 4px', borderBottom: '1px solid #F0F5F1', marginBottom: 0 }}>
            <div className="card-title" style={{ margin: 0 }}>Raspberry Pi Mode</div>
            <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(34,169,92,0.12)', color: '#16834A', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>BETA</span>
          </div>

          <SettingRow icon={Server} title="RPi mode" description="Enable Raspberry Pi mode — the fetch modal will show instructions for hosting the exported JSON on a local RPi server, so the app can read data from the device instead of live APIs.">
            <Toggle value={settings.rpiMode} onChange={v => update('rpiMode', v)}/>
          </SettingRow>

          {settings.rpiMode && (
            <div style={{ marginBottom: 16, background: '#1A2E1E', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#7ED9A0', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={13}/> RPi Setup Instructions
              </div>
              <div style={{ fontSize: 11, color: '#9DB8A2', fontFamily: 'JetBrains Mono, monospace', lineHeight: 2 }}>
                <div style={{ marginBottom: 8 }}>1. Export JSON from the Fetch modal or Settings → Cache</div>
                <div style={{ marginBottom: 8 }}>2. Copy to your RPi:</div>
                <pre style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 12px', color: '#7ED9A0', fontSize: 10, marginBottom: 8, overflowX: 'auto' }}>
{`scp vandrishti-data.json pi@<rpi-ip>:/var/www/html/data.json`}
                </pre>
                <div style={{ marginBottom: 8 }}>3. Enable CORS on RPi nginx/apache, or run the VanDrishti edge agent which serves the JSON endpoint at <code style={{ color: '#7ED9A0' }}>:8000/api/data</code></div>
                <div>4. In future builds, this app will auto-detect the RPi and read from it instead of live APIs.</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Reset ─────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '4px 20px 8px' }}>
          <div className="card-title" style={{ padding: '14px 0 4px', borderBottom: '1px solid #F0F5F1', marginBottom: 0 }}>
            Reset
          </div>
          <SettingRow icon={Trash2} title="Reset to defaults" description="Restore all settings to their factory defaults. Your API keys and cached zone data will not be affected.">
            <button
              onClick={() => { saveSettings(DEFAULT_SETTINGS); setLocalSettings(DEFAULT_SETTINGS) }}
              className="btn btn-ghost btn-sm"
              style={{ color: '#DC3545' }}
            >
              Reset
            </button>
          </SettingRow>
        </div>

      </div>

      <FetchModal open={fetchOpen} onClose={() => setFetchOpen(false)} />
    </>
  )
}
