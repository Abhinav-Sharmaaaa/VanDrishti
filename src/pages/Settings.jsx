import { useState, useEffect } from 'react'
import { Save, RefreshCw, Trash2, Download, Server, Clock, Database, Wifi, Bell, Send, Smartphone, CheckCircle, XCircle, Loader, Eye, EyeOff } from 'lucide-react'
import FetchModal from '../components/FetchModal'
import { getSettings, saveSettings, getCacheMeta, clearCache, downloadCacheJson, DEFAULT_SETTINGS } from '../services/dataCache'
import { notifyCacheUpdated, useCacheStatus } from '../hooks/useZoneData'
import {
  getNotifSettings, saveNotifSettings, DEFAULT_NOTIF_SETTINGS,
  requestBrowserPermission, getBrowserPermission,
  verifyBotToken, detectTelegramChatId,
  sendTestAlert,
} from '../services/notificationService'

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

  // ── Notification state ────────────────────────────────────────
  const [notif, setNotif]              = useState(getNotifSettings)
  const [notifSaved, setNotifSaved]    = useState(false)
  const [tokenStatus, setTokenStatus]  = useState(null)   // null | 'checking' | { ok, botName, error }
  const [detectStatus, setDetectStatus]= useState(null)   // null | 'detecting' | { ok, chatId, name, error }
  const [testStatus, setTestStatus]    = useState(null)   // null | 'sending' | { browser, telegram }
  const [showToken, setShowToken]      = useState(false)
  const [browserPerm, setBrowserPerm]  = useState(getBrowserPermission)

  const updateNotif     = (key, val) => setNotif(prev => ({ ...prev, [key]: val }))
  const updateTelegram  = (key, val) => setNotif(prev => ({ ...prev, telegram: { ...prev.telegram, [key]: val } }))
  const updateBrowser   = (key, val) => setNotif(prev => ({ ...prev, browser:  { ...prev.browser,  [key]: val } }))

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

  // ── Notification handlers ─────────────────────────────────────
  const handleSaveNotif = () => {
    saveNotifSettings(notif)
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  const handleRequestBrowser = async () => {
    const result = await requestBrowserPermission()
    setBrowserPerm(result)
    if (result === 'granted') {
      updateBrowser('enabled', true)
    }
  }

  const handleVerifyToken = async () => {
    setTokenStatus('checking')
    const result = await verifyBotToken(notif.telegram.botToken)
    setTokenStatus(result)
  }

  const handleDetectChatId = async () => {
    setDetectStatus('detecting')
    const result = await detectTelegramChatId(notif.telegram.botToken)
    setDetectStatus(result)
    if (result.ok) {
      updateTelegram('chatId', result.chatId)
    }
  }

  const handleTest = async () => {
    setTestStatus('sending')
    const result = await sendTestAlert()
    setTestStatus(result)
    setTimeout(() => setTestStatus(null), 5000)
  }

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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

        {/* ── Phone Alerts ──────────────────────────────────────────── */}
        <div className="card" style={{ padding: '4px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 4px', borderBottom: '1px solid #F0F5F1', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="card-title" style={{ margin: 0 }}>Phone Alerts</div>
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(34,169,92,0.12)', color: '#16834A', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>NEW</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {notif.enabled ? 'Enabled' : 'Disabled'}
              </span>
              <Toggle value={notif.enabled} onChange={v => updateNotif('enabled', v)} />
            </div>
          </div>

          {/* Master description */}
          <div style={{ padding: '10px 0 4px', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Send a notification directly to your phone each time you dispatch a response team from the Alert Center.
            The message includes the zone, FHI score, all detected problems, and the dispatched team's contact details.
          </div>

          {/* ── Telegram section ─────────────────────────────────────── */}
          <div style={{ margin: '10px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
            TELEGRAM BOT
          </div>

          <SettingRow icon={Send} title="Telegram alerts" description="Send alerts to your phone via a Telegram bot. No app install required beyond Telegram.">
            <Toggle value={notif.telegram.enabled} onChange={v => updateTelegram('enabled', v)} />
          </SettingRow>

          {/* Setup instructions */}
          {notif.telegram.enabled && (
            <div style={{ margin: '2px 0 14px', background: '#1A2E1E', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#7ED9A0', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={13} /> Telegram Setup — 3 steps
              </div>
              <div style={{ fontSize: 11, color: '#9DB8A2', lineHeight: 2 }}>
                <div><span style={{ color: '#7ED9A0', fontWeight: 700 }}>1.</span> Open Telegram and search for <code style={{ color: '#7ED9A0' }}>@BotFather</code></div>
                <div><span style={{ color: '#7ED9A0', fontWeight: 700 }}>2.</span> Send <code style={{ color: '#7ED9A0' }}>/newbot</code> and follow the prompts → copy the <b>bot token</b></div>
                <div><span style={{ color: '#7ED9A0', fontWeight: 700 }}>3.</span> Open your new bot and send it any message (e.g. <code style={{ color: '#7ED9A0' }}>hi</code>), then click <b>Detect Chat ID</b> below</div>
              </div>
            </div>
          )}

          {/* Bot token field */}
          {notif.telegram.enabled && (
            <div style={{ padding: '12px 0', borderBottom: '1px solid #F0F5F1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send size={16} color="#6B8872" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1A2E1E', marginBottom: 2 }}>Bot token</div>
                  <div style={{ fontSize: 12, color: '#6B8872' }}>From @BotFather — looks like <code>123456:ABC-xyz…</code></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="input"
                    type={showToken ? 'text' : 'password'}
                    placeholder="Paste bot token…"
                    value={notif.telegram.botToken}
                    onChange={e => { updateTelegram('botToken', e.target.value); setTokenStatus(null) }}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12, paddingRight: 36 }}
                  />
                  <button onClick={() => setShowToken(p => !p)} style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#6B8872', display: 'flex',
                  }}>
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  onClick={handleVerifyToken}
                  disabled={!notif.telegram.botToken || tokenStatus === 'checking'}
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {tokenStatus === 'checking'
                    ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Checking…</>
                    : 'Verify Token'}
                </button>
              </div>
              {/* Token status */}
              {tokenStatus && tokenStatus !== 'checking' && (
                <div style={{
                  marginTop: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
                  color: tokenStatus.ok ? '#16834A' : '#DC3545',
                }}>
                  {tokenStatus.ok
                    ? <><CheckCircle size={13} /> Connected as <strong>{tokenStatus.botName}</strong> (@{tokenStatus.username})</>
                    : <><XCircle size={13} /> {tokenStatus.error}</>}
                </div>
              )}
            </div>
          )}

          {/* Chat ID field */}
          {notif.telegram.enabled && (
            <div style={{ padding: '12px 0', borderBottom: '1px solid #F0F5F1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#F0F5F1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Smartphone size={16} color="#6B8872" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1A2E1E', marginBottom: 2 }}>Chat ID</div>
                  <div style={{ fontSize: 12, color: '#6B8872' }}>Your Telegram user ID — click Detect to find it automatically.</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder="e.g. 123456789"
                  value={notif.telegram.chatId}
                  onChange={e => { updateTelegram('chatId', e.target.value); setDetectStatus(null) }}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                />
                <button
                  onClick={handleDetectChatId}
                  disabled={!notif.telegram.botToken || detectStatus === 'detecting'}
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  {detectStatus === 'detecting'
                    ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Detecting…</>
                    : 'Detect Chat ID'}
                </button>
              </div>
              {/* Detect status */}
              {detectStatus && detectStatus !== 'detecting' && (
                <div style={{
                  marginTop: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
                  color: detectStatus.ok ? '#16834A' : '#DC3545',
                }}>
                  {detectStatus.ok
                    ? <><CheckCircle size={13} /> Found: Chat ID <strong>{detectStatus.chatId}</strong>{detectStatus.name ? ` (${detectStatus.name})` : ''} — auto-filled above.</>
                    : <><XCircle size={13} /> {detectStatus.error}</>}
                </div>
              )}
            </div>
          )}

          {/* ── Browser push section ──────────────────────────────────── */}
          <div style={{ margin: '10px 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', letterSpacing: '.06em' }}>
            BROWSER NOTIFICATIONS
          </div>

          <SettingRow
            icon={Bell}
            title="Browser push"
            description={
              browserPerm === 'unsupported' ? 'Not supported in this browser.' :
              browserPerm === 'denied' ? 'Permission denied — enable notifications for this site in your browser settings.' :
              browserPerm === 'granted' ? 'Permission granted. Alerts appear as system notifications.' :
              'Click to grant notification permission.'
            }
          >
            {browserPerm === 'granted' ? (
              <Toggle value={notif.browser.enabled} onChange={v => updateBrowser('enabled', v)} />
            ) : browserPerm === 'unsupported' || browserPerm === 'denied' ? (
              <span style={{ fontSize: 11, color: '#DC3545' }}>Unavailable</span>
            ) : (
              <button onClick={handleRequestBrowser} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Bell size={13} /> Allow Notifications
              </button>
            )}
          </SettingRow>

          {/* ── Test + Save row ───────────────────────────────────────── */}
          <div style={{ paddingTop: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleTest}
              disabled={testStatus === 'sending' || (!notif.telegram.enabled && !notif.browser.enabled)}
              className="btn btn-ghost btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {testStatus === 'sending'
                ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Sending test…</>
                : <><Send size={13} /> Send Test Alert</>}
            </button>

            {/* Test result feedback */}
            {testStatus && testStatus !== 'sending' && (
              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                {testStatus.browser && (
                  <span style={{ color: testStatus.browser.ok ? '#16834A' : '#DC3545', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {testStatus.browser.ok ? <CheckCircle size={12} /> : <XCircle size={12} />} Browser
                  </span>
                )}
                {testStatus.telegram && (
                  <span style={{ color: testStatus.telegram.ok ? '#16834A' : '#DC3545', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {testStatus.telegram.ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    Telegram {!testStatus.telegram.ok && `— ${testStatus.telegram.error}`}
                  </span>
                )}
              </div>
            )}

            <button onClick={handleSaveNotif} className="btn btn-primary" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Save size={14} />{notifSaved ? 'Saved ✓' : 'Save Alert Settings'}
            </button>
          </div>
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