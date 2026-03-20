/**
 * VanDrishti — AI Forest Intelligence Chatbot
 *
 * Floating widget — mount once in App.jsx:
 *   import ChatWidget from './components/ChatWidget'
 *   <ChatWidget />   ← outside .app-layout, inside the root fragment
 *
 * Uses Groq's FREE API (Llama 3.3 70B) — no cost, no credit card.
 * Get a free key at console.groq.com → API Keys, then add to .env:
 *   VITE_GROQ_API_KEY=gsk_xxxxxxxxxxxx
 *
 * Vite proxies /groq/* → https://api.groq.com/* to avoid CORS.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X, Send, Leaf, RotateCcw, ChevronDown, AlertCircle } from 'lucide-react'

// ---------------------------------------------------------------------------
// Groq config — proxied through Vite to avoid CORS
// ---------------------------------------------------------------------------
const GROQ_URL   = '/groq/openai/v1/chat/completions'
const GROQ_KEY   = import.meta.env.VITE_GROQ_API_KEY ?? ''
const GROQ_MODEL = 'llama-3.3-70b-versatile'   // free, fast, smart

// ---------------------------------------------------------------------------
// Read live zone + alert data from localStorage cache
// ---------------------------------------------------------------------------
function getZoneSummary() {
  try {
    const raw = localStorage.getItem('vandrishti_zone_cache')
    if (!raw) return null
    const zones = Object.values(JSON.parse(raw))
    if (!zones.length) return null

    const lines = zones.map(z =>
      `• ${z.name} [FHI:${z.fhi} ${(z.status ?? '').toUpperCase()}] ` +
      `NDVI:${z.signals?.ndvi ?? '—'}% fires:${z.fire?.count ?? 0} ` +
      `biodiversity:${z.signals?.biodiversity ?? '—'}% moisture:${z.signals?.moisture ?? '—'}% ` +
      `temp:${z.weather?.temp ?? '—'}°C weather:${z.weather?.condition ?? '—'} ` +
      `carbon:${z.carbonStock?.toLocaleString() ?? '—'}t`
    )

    const avgFhi      = Math.round(zones.reduce((s, z) => s + (z.fhi ?? 0), 0) / zones.length)
    const totalFires  = zones.reduce((s, z) => s + (z.fire?.count ?? 0), 0)
    const critical    = zones.filter(z => z.status === 'critical').length
    const alert       = zones.filter(z => z.status === 'alert').length
    const healthy     = zones.filter(z => z.status === 'healthy').length

    return [
      `LIVE ZONE DATA (${zones.length} zones monitored):`,
      `Summary — Avg FHI: ${avgFhi} | Total fires: ${totalFires} | Healthy: ${healthy} | Alert: ${alert} | Critical: ${critical}`,
      '',
      ...lines,
    ].join('\n')
  } catch { return null }
}

function getCacheAge() {
  try {
    const raw = localStorage.getItem('vandrishti_cache_meta')
    if (!raw) return null
    const age = Math.round((Date.now() - new Date(JSON.parse(raw).fetchedAt).getTime()) / 60_000)
    return `Data fetched ${age} minute${age !== 1 ? 's' : ''} ago.`
  } catch { return null }
}

function buildSystemPrompt() {
  const zoneSummary = getZoneSummary()
  const cacheAge    = getCacheAge()

  const zoneSection = zoneSummary
    ? `\n\n${zoneSummary}\n\n${cacheAge ?? ''}`
    : '\n\nNo zone data cached yet. Ask the user to click the Fetch button in the header.'

  return `You are VanAI, the forest intelligence assistant for VanDrishti — a real-time forest health monitoring platform for Indian wildlife reserves (Jim Corbett, Sundarbans).

Your users are rangers, forest officers, and ecologists. Be concise, expert, and actionable.

SIGNAL GUIDE:
- FHI (Forest Health Index 0–100): ≥60 healthy · 40–59 watch · 20–39 alert · <20 critical
- NDVI: vegetation density (0–100%). <40% = canopy stress
- Biodiversity index: <50% = loss alert
- Moisture score: <40% = drought risk
- Thermal/fire count: >5 events = fire outbreak threshold

ALERT TYPES: fire_outbreak · thermal_anomaly · biodiversity_loss · moisture_stress · canopy_decline

RESPONSE TEAMS: DFO · RFO · Forest Ranger · Wildlife Warden · State Fire Dept · SDRF · Irrigation Dept

HOW TO USE VANDRISHTI:
- Dashboard: FHI overview + recent alerts across all zones
- Zones: map + grid view; draw custom zones; dispatch rangers directly
- Zone Detail: per-zone deep dive — FWI chart, NDVI trend, weather forecast, biodiversity breakdown
- Alert Center: classified problems + one-click government team dispatch
- Edge Nodes: Raspberry Pi ground-truth sensors confirming satellite data
- Analytics: cross-zone comparison
- Settings: fetch interval, Telegram notifications, RPi export mode
- Fetch button (header): pulls NASA FIRMS, Copernicus NDVI, GBIF, eBird, Open-Meteo

TONE: Concise bullet points, bold key numbers, never fabricate data.${zoneSection}`
}

// ---------------------------------------------------------------------------
// Groq API call (streaming via SSE)
// ---------------------------------------------------------------------------
async function streamChat(messages, onChunk, onDone, onError) {
  if (!GROQ_KEY) {
    onError('No Groq API key found. Add VITE_GROQ_API_KEY to your .env file.')
    return
  }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        max_tokens:  1024,
        stream:      true,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          ...messages,
        ],
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Groq ${res.status}: ${err.slice(0, 160)}`)
    }

    const reader = res.body.getReader()
    const dec    = new TextDecoder()
    let   buf    = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })

      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
          if (delta) onChunk(delta)
        } catch {}
      }
    }
    onDone()
  } catch (err) {
    onError(err.message)
  }
}

// ---------------------------------------------------------------------------
// Markdown-lite renderer
// ---------------------------------------------------------------------------
function inlineFormat(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.87em', background: 'rgba(34,169,92,0.1)', padding: '1px 5px', borderRadius: 4 }}>{part.slice(1, -1)}</code>
    return part
  })
}

function renderMarkdown(text) {
  const lines = text.split('\n')
  const out   = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^[-*•]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i]))
        items.push(lines[i++].replace(/^[-*•]\s/, ''))
      out.push(
        <ul key={i} style={{ margin: '5px 0 5px 14px', padding: 0, listStyle: 'disc' }}>
          {items.map((it, j) => <li key={j} style={{ marginBottom: 2 }}>{inlineFormat(it)}</li>)}
        </ul>
      )
      continue
    }
    if (!line.trim()) { out.push(<div key={i} style={{ height: 5 }}/>); i++; continue }
    out.push(<p key={i} style={{ margin: '2px 0', lineHeight: 1.55 }}>{inlineFormat(line)}</p>)
    i++
  }
  return out
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
const SUGGESTIONS = [
  'Which zones need immediate attention?',
  'Explain the FHI for Corbett-A',
  'What does NDVI below 40% mean?',
  'How do I dispatch a response team?',
  'What causes fire weather index to spike?',
  'How do I add a custom zone on the map?',
]

// ---------------------------------------------------------------------------
// Bubble
// ---------------------------------------------------------------------------
function Bubble({ role, content, streaming }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10, animation: 'vanIn 0.18s ease' }}>
      {!isUser && (
        <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, marginRight: 8, marginTop: 2, background: 'linear-gradient(135deg,#2ECC71,#1A7A3E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Leaf size={13} color="#fff"/>
        </div>
      )}
      <div style={{
        maxWidth: '82%', padding: isUser ? '8px 13px' : '9px 13px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? 'linear-gradient(135deg,#22A95C,#1A7A3E)' : 'var(--bg-surface2)',
        color: isUser ? '#fff' : 'var(--text-primary)',
        fontSize: 12.5, lineHeight: 1.5,
        boxShadow: isUser ? '0 2px 8px rgba(34,169,92,0.22)' : '0 1px 4px rgba(0,0,0,0.06)',
        border: isUser ? 'none' : '1px solid var(--border)',
        fontFamily: 'var(--font-body,system-ui)',
      }}>
        {isUser ? content : renderMarkdown(content)}
        {streaming && (
          <span style={{ display: 'inline-block', width: 7, height: 13, marginLeft: 3, background: '#22A95C', borderRadius: 2, verticalAlign: 'middle', animation: 'vanBlink 0.8s step-end infinite' }}/>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------
export default function ChatWidget() {
  const [open,      setOpen]      = useState(false)
  const [messages,  setMessages]  = useState([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [hasData,   setHasData]   = useState(false)
  const [unread,    setUnread]    = useState(0)
  const [showSugg,  setShowSugg]  = useState(true)
  const [noKey,     setNoKey]     = useState(!GROQ_KEY)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    const check = () => setHasData(!!localStorage.getItem('vandrishti_zone_cache'))
    check()
    window.addEventListener('vandrishti:cache-updated', check)
    return () => window.removeEventListener('vandrishti:cache-updated', check)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 80); setUnread(0) }
  }, [open])

  const send = useCallback(async (text) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    setInput('')
    setShowSugg(false)

    const userMsg = { role: 'user', content }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }])
    setStreaming(true)

    const apiMessages = [...messages, userMsg]
    let full = ''

    await streamChat(
      apiMessages,
      (chunk) => {
        full += chunk
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: full }
          return next
        })
      },
      () => {
        setStreaming(false)
        if (!open) setUnread(n => n + 1)
      },
      (errMsg) => {
        setStreaming(false)
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: `⚠️ ${errMsg}` }
          return next
        })
      }
    )
  }, [input, messages, streaming, open])

  const reset = () => { setMessages([]); setInput(''); setStreaming(false); setShowSugg(true) }

  return (
    <>
      <style>{`
        @keyframes vanIn    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes vanBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes vanUp    { from{opacity:0;transform:translateY(14px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes vanPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .van-panel  { animation: vanUp 0.22s cubic-bezier(0.22,1,0.36,1) }
        .van-scroll::-webkit-scrollbar { width:4px }
        .van-scroll::-webkit-scrollbar-thumb { background:rgba(34,169,92,0.2);border-radius:4px }
        .van-sugg:hover { background:rgba(34,169,92,0.1) !important; border-color:rgba(34,169,92,0.35) !important; color:var(--green) !important }
        .van-input:focus { outline:none; border-color:#22A95C !important; box-shadow:0 0 0 3px rgba(34,169,92,0.1) !important }
      `}</style>

      {/* Toggle button */}
      <button onClick={() => setOpen(v => !v)} title="VanAI Forest Assistant" style={{
        position:'fixed', bottom:24, right:24, zIndex:9990,
        width:52, height:52, borderRadius:16, border:'none', cursor:'pointer', color:'#fff',
        background:'linear-gradient(135deg,#22A95C 0%,#1A5C35 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(34,169,92,0.4),0 1px 4px rgba(0,0,0,0.1)',
        transition:'transform 0.18s, box-shadow 0.18s',
        animation: messages.length === 0 && !open ? 'vanPulse 2.6s ease-in-out infinite' : 'none',
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.09)';e.currentTarget.style.boxShadow='0 6px 28px rgba(34,169,92,0.52)'}}
        onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 4px 20px rgba(34,169,92,0.4),0 1px 4px rgba(0,0,0,0.1)'}}>
        {open ? <ChevronDown size={20}/> : <MessageSquare size={20}/>}
        {unread > 0 && !open && (
          <span style={{ position:'absolute', top:-4, right:-4, width:18, height:18, borderRadius:'50%', background:'#DC3545', color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid #fff' }}>{unread}</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="van-panel" style={{
          position:'fixed', bottom:86, right:24, zIndex:9989,
          width:360, height:520, borderRadius:20,
          background:'var(--bg-card)',
          border:'1px solid var(--border)',
          boxShadow:'0 12px 48px rgba(0,0,0,0.13)',
          display:'flex', flexDirection:'column', overflow:'hidden',
          fontFamily:'var(--font-body,system-ui)',
        }}>

          {/* Header */}
          <div style={{ padding:'13px 15px 11px', background:'linear-gradient(135deg,#1A2E1E,#0E1F14)', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg,#2ECC71,#1A7A3E)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(46,204,113,0.3)', flexShrink:0 }}>
              <Leaf size={16} color="#fff"/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13.5, color:'#E8F5EC' }}>VanAI</div>
              <div style={{ fontSize:10, color:'#6B8F72', fontFamily:'var(--font-mono,monospace)', display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background: noKey ? '#DC3545' : hasData ? '#2ECC71' : '#D97706', display:'inline-block' }}/>
                {noKey ? 'Missing VITE_GROQ_API_KEY in .env' : hasData ? 'Live zone data loaded' : 'No zone data — fetch first'}
              </div>
            </div>
            <div style={{ display:'flex', gap:5 }}>
              {messages.length > 0 && (
                <button onClick={reset} title="Clear chat" style={{ background:'rgba(255,255,255,0.07)', border:'none', color:'#6B8F72', width:28, height:28, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <RotateCcw size={13}/>
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background:'rgba(255,255,255,0.07)', border:'none', color:'#6B8F72', width:28, height:28, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <X size={14}/>
              </button>
            </div>
          </div>

          {/* No-key warning banner */}
          {noKey && (
            <div style={{ padding:'8px 14px', background:'rgba(220,53,69,0.08)', borderBottom:'1px solid rgba(220,53,69,0.15)', display:'flex', alignItems:'flex-start', gap:8 }}>
              <AlertCircle size={13} color="#DC3545" style={{ flexShrink:0, marginTop:1 }}/>
              <div style={{ fontSize:11, color:'#DC3545', lineHeight:1.45 }}>
                Add <code style={{ fontFamily:'var(--font-mono,monospace)', background:'rgba(220,53,69,0.1)', padding:'0 4px', borderRadius:3 }}>VITE_GROQ_API_KEY=gsk_...</code> to your <strong>.env</strong> file, then restart the dev server. Get a free key at <strong>console.groq.com</strong>.
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="van-scroll" style={{ flex:1, overflowY:'auto', padding:'13px 13px 6px' }}>
            {messages.length === 0 && (
              <div style={{ animation:'vanIn 0.28s ease' }}>
                <div style={{ textAlign:'center', padding:'8px 6px 14px' }}>
                  <div style={{ width:46, height:46, borderRadius:13, margin:'0 auto 9px', background:'linear-gradient(135deg,#2ECC71,#1A7A3E)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(34,169,92,0.28)' }}>
                    <Leaf size={21} color="#fff"/>
                  </div>
                  <div style={{ fontWeight:700, fontSize:13.5, color:'var(--text-primary)', marginBottom:4 }}>Forest Intelligence Assistant</div>
                  <div style={{ fontSize:11.5, color:'var(--text-secondary)', lineHeight:1.5 }}>
                    Ask about zone health, alerts, fire risk, biodiversity, or how to use VanDrishti.
                  </div>
                  <div style={{ marginTop:6, fontSize:10, color:'var(--text-muted)', fontFamily:'var(--font-mono,monospace)' }}>
                    Powered by Llama 3.3 70B via Groq · Free
                  </div>
                </div>
                {showSugg && (
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    <div style={{ fontSize:9.5, color:'var(--text-secondary)', fontFamily:'var(--font-mono,monospace)', fontWeight:600, marginBottom:1, letterSpacing:.04 }}>SUGGESTED</div>
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} className="van-sugg" onClick={() => send(s)} style={{
                        textAlign:'left', background:'var(--bg-surface2)',
                        border:'1px solid var(--border)', borderRadius:10,
                        padding:'7px 11px', fontSize:11.5, color:'var(--text-primary)',
                        cursor:'pointer', fontFamily:'inherit', transition:'all 0.14s',
                        animation:`vanIn 0.22s ease ${i*40}ms both`,
                      }}>{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <Bubble key={i} role={msg.role} content={msg.content}
                streaming={streaming && i === messages.length - 1 && msg.role === 'assistant'}/>
            ))}
            <div ref={bottomRef}/>
          </div>

          {/* Input */}
          <div style={{ padding:'9px 11px 11px', borderTop:'1px solid var(--border)', background:'var(--bg-surface)', flexShrink:0 }}>
            <div style={{ display:'flex', gap:7, alignItems:'flex-end' }}>
              <textarea
                ref={inputRef}
                className="van-input"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                onInput={e => { e.target.style.height='auto'; e.target.style.height = Math.min(e.target.scrollHeight, 88) + 'px' }}
                placeholder="Ask about zones, alerts, ecology…"
                rows={1} disabled={streaming || noKey}
                style={{ flex:1, resize:'none', border:'1.5px solid var(--border)', borderRadius:11, padding:'8px 11px', fontSize:12.5, fontFamily:'inherit', background:'var(--bg-card)', color:'var(--text-primary)', lineHeight:1.5, maxHeight:88, overflowY:'auto', transition:'border-color 0.18s, box-shadow 0.18s' }}
              />
              <button onClick={() => send()} disabled={!input.trim() || streaming || noKey} style={{
                width:36, height:36, borderRadius:10, border:'none', flexShrink:0,
                background: input.trim() && !streaming && !noKey ? '#22A95C' : 'var(--bg-surface2)',
                color:      input.trim() && !streaming && !noKey ? '#fff' : 'var(--text-secondary)',
                cursor:     input.trim() && !streaming && !noKey ? 'pointer' : 'not-allowed',
                display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.16s',
              }}>
                {streaming
                  ? <div style={{ width:14, height:14, border:'2px solid currentColor', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }}/>
                  : <Send size={14}/>}
              </button>
            </div>
            <div style={{ fontSize:9.5, color:'var(--text-muted)', marginTop:5, textAlign:'center', fontFamily:'var(--font-mono,monospace)' }}>
              Enter to send · Shift+Enter for newline
            </div>
          </div>

        </div>
      )}
    </>
  )
}