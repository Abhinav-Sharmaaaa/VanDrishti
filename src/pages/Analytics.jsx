import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Bar, Line, Radar, Doughnut, Scatter } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, ArcElement, Filler,
  Tooltip as ChartTooltip, Legend,
} from 'chart.js'
import {
  BarChart2, TrendingUp, Activity, PieChart, ScatterChart,
  Download, RefreshCw, ChevronDown,
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones } from '../hooks/useZoneData'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, RadialLinearScale, ArcElement, Filler,
  ChartTooltip, Legend,
)

// ── Design tokens (mirrors app CSS vars) ─────────────────────────────────────
const T = {
  green:   '#22A95C',
  amber:   '#D97706',
  red:     '#DC3545',
  teal:    '#0EA58C',
  blue:    '#3B82F6',
  purple:  '#7C3AED',
  dark:    'var(--text-primary)',
  muted:   'var(--text-muted)',
  surface: 'var(--bg-surface)',
  border:  'var(--border)',
  bg:      'var(--bg-card)',
  mono:    'JetBrains Mono, monospace',
  body:    'Inter, sans-serif',
}

const ZONE_PALETTE = ['#22A95C', '#D97706', '#0EA58C', '#DC3545', '#7C3AED', '#3B82F6']

// ── Shared chart defaults ─────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600, easing: 'easeInOutQuart' },
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: 'var(--text-muted)', font: { family: T.mono, size: 10 }, boxWidth: 10, padding: 12 },
    },
    tooltip: {
      backgroundColor: 'var(--bg-card)',
      borderColor: 'var(--border)',
      borderWidth: 1,
      titleColor: 'var(--text-primary)',
      bodyColor: T.green,
      bodyFont: { family: T.mono, size: 11 },
      titleFont: { family: T.mono, size: 11, weight: '600' },
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      ticks: { color: 'var(--text-muted)', font: { family: T.mono, size: 10 } },
      grid:  { color: 'var(--chart-grid)' },
      border:{ color: 'var(--chart-grid)' },
    },
    y: {
      min: 0, max: 100,
      ticks: { color: 'var(--text-muted)', font: { family: T.mono, size: 10 }, stepSize: 25 },
      grid:  { color: 'var(--chart-grid)' },
      border:{ color: 'var(--chart-grid)' },
    },
  },
}

// ── Data generators ───────────────────────────────────────────────────────────
function gen14DayHistory(fhi) {
  const d = []
  for (let i = 13; i >= 0; i--)
    d.push(Math.max(5, Math.min(100, fhi + 8 + Math.random() * 8 - (i < 5 ? (5-i)*3 : 0))))
  return d
}
function gen7DayPrediction(fhi) {
  let v = fhi; const d = []
  for (let i = 0; i < 7; i++) { v = Math.max(10, v - 2 - Math.random()*3); d.push(v) }
  return d
}

// ── Heat colour ───────────────────────────────────────────────────────────────
function heatColor(val) {
  if (val >= 70) return 'rgba(34,169,92,0.55)'
  if (val >= 50) return 'rgba(34,169,92,0.25)'
  if (val >= 35) return 'rgba(217,119,6,0.40)'
  return            'rgba(220,53,69,0.40)'
}
function heatText(val) {
  if (val >= 70) return T.green
  if (val >= 50) return '#16A34A'
  if (val >= 35) return T.amber
  return T.red
}

// ── Animate-on-enter hook ─────────────────────────────────────────────────────
function useEntrance(delay = 0) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(16px)'
    const t = setTimeout(() => {
      el.style.transition = 'opacity .45s ease, transform .45s ease'
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    }, delay)
    return () => clearTimeout(t)
  }, [delay])
  return ref
}

// ── Animated number ───────────────────────────────────────────────────────────
function AnimNum({ value, suffix = '', color = 'var(--text-primary)' }) {
  const [disp, setDisp] = useState(0)
  useEffect(() => {
    const n = parseFloat(String(value).replace(/[^\d.]/g, '')) || 0
    let cur = 0; const step = Math.max(1, Math.ceil(n / 20))
    const t = setInterval(() => {
      cur = Math.min(cur + step, n); setDisp(cur)
      if (cur >= n) clearInterval(t)
    }, 35)
    return () => clearInterval(t)
  }, [value])
  return <span style={{ color }}>{typeof value === 'string' ? value.replace(/[\d.]+/, Math.round(disp).toLocaleString()) : Math.round(disp).toLocaleString()}{suffix}</span>
}

// ── Chart type toggle ─────────────────────────────────────────────────────────
function ChartToggle({ options, value, onChange }) {
  return (
    <div style={{ display:'flex', gap:2, background:'var(--bg-surface)', borderRadius:8, padding:3 }}>
      {options.map(({ key, icon: Icon, label }) => (
        <button key={key} title={label} onClick={() => onChange(key)} style={{
          display:'flex', alignItems:'center', gap:4,
          padding:'4px 10px', borderRadius:6, border:'none', cursor:'pointer',
          fontSize:11, fontWeight:500, fontFamily:T.body,
          background: value===key ? 'var(--text-primary)' : 'transparent',
          color:       value===key ? '#7ED9A0' : 'var(--text-muted)',
          transition: 'all .15s',
        }}>
          <Icon size={12}/>{label}
        </button>
      ))}
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────────────────────
function SCard({ title, subtitle, actions, children, delay=0, minH }) {
  const ref = useEntrance(delay)
  return (
    <div ref={ref} className="card" style={{ minHeight: minH }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div className="card-title" style={{ marginBottom: subtitle ? 2 : 0 }}>{title}</div>
          {subtitle && <div style={{ fontSize:10, color:'var(--text-muted)', fontFamily:T.mono }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display:'flex', gap:6, alignItems:'center' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { zones: zonesMap, loading } = useAllZones(60_000)
  const [fhiChartType,    setFhiChartType]    = useState('bar')
  const [carbonChartType, setCarbonChartType] = useState('bars')
  const [signalChartType, setSignalChartType] = useState('heatmap')
  const [forecastZoneId,  setForecastZoneId]  = useState(null)
  const [dateRange,       setDateRange]       = useState('30d')

  const h1 = useEntrance(0)
  const statsRef = useEntrance(80)

  if (loading || !Object.keys(zonesMap).length) return <LoadingSpinner message="Loading analytics…"/>

  const zones = Object.values(zonesMap)

  // Set default forecast zone to worst
  const worstZone = zones.reduce((a,b) => a.fhi<b.fhi ? a : b)
  const fzId = forecastZoneId || worstZone.id
  const fzOne = zones.find(z=>z.id===fzId) || worstZone

  // Aggregates
  const avgFhi      = Math.round(zones.reduce((s,z)=>s+z.fhi,0)/zones.length)
  const totalFire   = zones.reduce((s,z)=>s+z.fire.count,0)
  const totalCarbon = zones.reduce((s,z)=>s+z.carbonStock,0)
  const atRisk      = zones.filter(z=>z.status!=='healthy').length

  // Weekly FHI data
  const weeks = ['Wk 1','Wk 2','Wk 3','Wk 4']
  const fhiBarDatasets = zones.map((z,i) => ({
    label: z.name,
    data: weeks.map((_,wi)=>Math.max(10, z.fhi+(3-wi)*(Math.random()*4+1)*(z.fhi<50?1:-0.3))),
    backgroundColor: ZONE_PALETTE[i%ZONE_PALETTE.length],
    borderColor:     ZONE_PALETTE[i%ZONE_PALETTE.length],
    borderRadius: 4, barPercentage:.7, categoryPercentage:.7, borderWidth:2,
    pointRadius:3, pointHoverRadius:5, fill:false, tension:.35,
  }))

  // Radar data
  const radarData = {
    labels: ['NDVI','Biodiversity','Fire Safety','Moisture','Cover Health'],
    datasets: zones.map((z,i) => ({
      label: z.name,
      data: [
        z.signals.ndvi,
        z.signals.biodiversity,
        100 - z.signals.thermalRisk,
        z.signals.moisture,
        z.signals.coverHealth,
      ],
      borderColor: ZONE_PALETTE[i%ZONE_PALETTE.length],
      backgroundColor: ZONE_PALETTE[i%ZONE_PALETTE.length]+'22',
      pointBackgroundColor: ZONE_PALETTE[i%ZONE_PALETTE.length],
      borderWidth: 2, pointRadius: 3,
    })),
  }

  // Doughnut — avg signal breakdown across all zones
  const avgSignals = {
    ndvi:       Math.round(zones.reduce((s,z)=>s+z.signals.ndvi,0)/zones.length),
    bio:        Math.round(zones.reduce((s,z)=>s+z.signals.biodiversity,0)/zones.length),
    fire:       Math.round(zones.reduce((s,z)=>s+(100-z.signals.thermalRisk),0)/zones.length),
    moisture:   Math.round(zones.reduce((s,z)=>s+z.signals.moisture,0)/zones.length),
    cover:      Math.round(zones.reduce((s,z)=>s+z.signals.coverHealth,0)/zones.length),
  }
  const doughnutData = {
    labels: ['NDVI','Biodiversity','Fire Safety','Moisture','Cover Health'],
    datasets:[{ data:[avgSignals.ndvi,avgSignals.bio,avgSignals.fire,avgSignals.moisture,avgSignals.cover],
      backgroundColor:[T.green,'#0EA58C',T.red,T.blue,T.purple],
      borderWidth:0, hoverOffset:6,
    }],
  }

  // Carbon data
  const carbonMax = Math.max(...zones.map(z=>z.carbonStock),1)
  const carbonBarData = {
    labels: zones.map(z=>z.name),
    datasets:[{
      label:'Carbon Stock (t)',
      data: zones.map(z=>z.carbonStock),
      backgroundColor: zones.map(z=> z.status==='critical'||z.status==='alert' ? T.red+'cc' : z.status==='watch' ? T.amber+'cc' : T.green+'cc'),
      borderRadius:6, barPercentage:.6,
    }],
  }
  const carbonDoughnutData = {
    labels: zones.map(z=>z.name),
    datasets:[{
      data: zones.map(z=>z.carbonStock),
      backgroundColor: zones.map((_,i)=>ZONE_PALETTE[i%ZONE_PALETTE.length]+'dd'),
      borderWidth:0, hoverOffset:8,
    }],
  }

  // Scatter — FHI vs NDVI correlation
  const scatterData = {
    datasets:[{
      label:'FHI vs NDVI',
      data: zones.map(z=>({ x:z.signals.ndvi, y:z.fhi, label:z.name })),
      backgroundColor: zones.map((_,i)=>ZONE_PALETTE[i%ZONE_PALETTE.length]+'cc'),
      pointRadius:8, pointHoverRadius:11,
    }],
  }

  // Heatmap data
  const heatRows = zones.map(z=>({
    zone:z.name,
    ndvi:z.signals.ndvi, bio:z.signals.biodiversity,
    thermal:100-z.signals.thermalRisk, moisture:z.signals.moisture,
  }))

  // Forecast
  const hist = useMemo(()=>gen14DayHistory(fzOne.fhi), [fzOne.id])
  const pred = useMemo(()=>gen7DayPrediction(fzOne.fhi),  [fzOne.id])
  const forecastData = {
    labels:[...Array.from({length:14},(_,i)=>`D-${14-i}`),...Array.from({length:7},(_,i)=>`D+${i+1}`)],
    datasets:[
      { label:'Historical', data:[...hist,...Array(7).fill(null)], borderColor:T.green, borderWidth:2, pointRadius:0, tension:.3 },
      { label:'Prediction',
        data:[...Array(13).fill(null),hist[hist.length-1],...pred],
        borderColor:T.amber, borderWidth:2, borderDash:[5,4],
        pointRadius:0, fill:true, backgroundColor:'rgba(217,119,6,0.07)', tension:.3,
      },
    ],
  }

  const chartAreaStyle = { height:240 }

  return (
    <>
      {/* ── Injected page-level styles ───────────────────────────────── */}
      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn  { from{opacity:0;transform:scale(.93)}       to{opacity:1;transform:scale(1)}     }
        @keyframes barGrow  { from{transform:scaleY(0)} to{transform:scaleY(1)} }

        .ana-stat { transition:box-shadow .2s, transform .2s; cursor:default }
        .ana-stat:hover { transform:translateY(-3px); box-shadow:0 6px 20px rgba(26,46,30,.1) }

        .vis-card { transition:box-shadow .2s, transform .2s }
        .vis-card:hover { box-shadow:0 6px 24px rgba(26,46,30,.09) }

        .hm-cell {
          padding:8px 4px; text-align:center;
          font-size:11px; font-family:${T.mono}; font-weight:600;
          border-radius:6px; transition:filter .15s, transform .15s; cursor:default;
        }
        .hm-cell:hover { filter:brightness(1.12); transform:scale(1.06) }

        .carbon-bar-track { height:8px; background:${'var(--bg-surface)'}; border-radius:4px; overflow:hidden; margin:4px 0 }
        .carbon-bar-fill  { height:100%; border-radius:4px; transition:width .7s cubic-bezier(.4,0,.2,1) }

        .forecast-zone-btn { border:none; cursor:pointer; padding:4px 10px; border-radius:6px;
          font-size:10px; font-family:${T.mono}; font-weight:600; transition:all .15s }
        .forecast-zone-btn.active { background:${'var(--text-primary)'}; color:#7ED9A0 }
        .forecast-zone-btn:not(.active) { background:${'var(--bg-surface)'}; color:${'var(--text-muted)'} }
        .forecast-zone-btn:not(.active):hover { background:${'var(--border)'}; color:${'var(--text-primary)'} }

        .src-pill {
          font-size:9px; padding:2px 8px; border-radius:10px; font-family:${T.mono};
          transition:transform .15s;
        }
        .src-pill:hover { transform:scale(1.05) }
      `}</style>

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="top-bar">
        <h1 className="page-title" ref={h1}>Analytics</h1>
        <div className="top-bar-right">
          <select className="input" value={dateRange} onChange={e=>setDateRange(e.target.value)}
            style={{ fontFamily:T.mono, fontSize:11 }}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button className="btn btn-ghost btn-sm" style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Download size={13}/>Export PDF
          </button>
        </div>
      </div>

      {/* ── Data source pills ─────────────────────────────────────────── */}
      {zones[0] && (
        <div style={{ display:'flex', gap:5, marginBottom:14, flexWrap:'wrap' }}>
          {Object.entries(zones[0].dataSource).map(([key,src]) => (
            <span key={key} className="src-pill" style={{
              background: src==='mock' ? 'rgba(217,119,6,0.12)' : 'rgba(34,169,92,0.12)',
              color:       src==='mock' ? T.amber : T.green,
            }}>{key}: {src}</span>
          ))}
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────── */}
      <div className="stats-row" ref={statsRef}>
        {[
          { val: avgFhi,                               color:T.amber, label:'Avg FHI',          sub:'All Zones'                 },
          { val: totalFire,                            color:T.red,   label:'Thermal Events',    sub:'NASA FIRMS'                },
          { val: totalCarbon.toLocaleString()+'t',     color:T.green, label:'Carbon Stock CO₂',  sub:'Estimated'                 },
          { val: `${atRisk} / ${zones.length}`,        color:T.amber, label:'Zones at Risk',     sub:'Watch + Alert + Critical'  },
        ].map(({ val, color, label, sub }, i) => (
          <div key={label} className="stat-card ana-stat"
            style={{ animation:`fadeUp .4s ease ${i*70}ms both` }}>
            <div className="stat-card-value" style={{ color }}>{val}</div>
            <div className="stat-card-label">{label}</div>
            {sub && <div style={{ fontSize:9, color:'var(--text-muted)', fontFamily:T.mono }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div className="two-col col-50-50">

        {/* ── LEFT ──────────────────────────────────────────────────── */}
        <div className="stack">

          {/* FHI Comparison — switchable */}
          <SCard delay={120}
            title="FHI Comparison — All Zones"
            subtitle={`${dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'Last 90 days'} · weekly approximations`}
            actions={
              <ChartToggle value={fhiChartType} onChange={setFhiChartType} options={[
                { key:'bar',   icon:BarChart2,   label:'Bar'   },
                { key:'line',  icon:TrendingUp,  label:'Line'  },
                { key:'radar', icon:Activity,    label:'Radar' },
              ]}/>
            }>
            <div className="chart-container vis-card" style={chartAreaStyle}>
              {fhiChartType === 'bar' && (
                <Bar data={{ labels:weeks, datasets:fhiBarDatasets }}
                  options={{ ...CHART_DEFAULTS, plugins:{...CHART_DEFAULTS.plugins} }}/>
              )}
              {fhiChartType === 'line' && (
                <Line data={{ labels:weeks, datasets:fhiBarDatasets }}
                  options={{ ...CHART_DEFAULTS, plugins:{...CHART_DEFAULTS.plugins}, elements:{point:{radius:4,hoverRadius:6}} }}/>
              )}
              {fhiChartType === 'radar' && (
                <Radar data={radarData} options={{
                  responsive:true, maintainAspectRatio:false,
                  animation:CHART_DEFAULTS.animation,
                  plugins:{ ...CHART_DEFAULTS.plugins },
                  scales:{
                    r:{
                      min:0, max:100,
                      ticks:{ color:'var(--text-muted)', font:{family:T.mono,size:9}, stepSize:25, backdropColor:'transparent' },
                      grid:{ color:'var(--chart-grid)' },
                      pointLabels:{ color:'var(--text-muted)', font:{family:T.mono,size:10} },
                      angleLines:{ color:'var(--chart-grid)' },
                    }
                  }
                }}/>
              )}
            </div>
          </SCard>

          {/* Carbon Stock — switchable */}
          <SCard delay={180}
            title="Carbon Stock by Zone"
            subtitle="Estimated CO₂ sequestration in tonnes"
            actions={
              <ChartToggle value={carbonChartType} onChange={setCarbonChartType} options={[
                { key:'bars',     icon:BarChart2,  label:'Bars'    },
                { key:'chart',    icon:BarChart2,  label:'Chart'   },
                { key:'doughnut', icon:PieChart,   label:'Donut'   },
              ]}/>
            }>
            {carbonChartType === 'bars' && (
              <div>
                {zones.map(z => {
                  const pct = Math.round((z.carbonStock/carbonMax)*100)
                  const col = z.status==='critical'||z.status==='alert' ? T.red : z.status==='watch' ? T.amber : T.green
                  return (
                    <div key={z.id} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                        <span style={{ fontSize:12, color:'var(--text-primary)', fontWeight:500 }}>{z.name}</span>
                        <span style={{ fontFamily:T.mono, fontSize:11, color:col, fontWeight:700 }}>{z.carbonStock.toLocaleString()}t</span>
                      </div>
                      <div className="carbon-bar-track">
                        <div className="carbon-bar-fill" style={{ width:`${pct}%`, background:col }}/>
                      </div>
                      <span style={{ fontSize:9, color:col, fontFamily:T.mono }}>
                        {z.status==='critical'?'Critical loss':z.status==='watch'?'Declining':'Stable'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {carbonChartType === 'chart' && (
              <div className="chart-container vis-card" style={chartAreaStyle}>
                <Bar data={carbonBarData} options={{
                  ...CHART_DEFAULTS,
                  indexAxis:'y',
                  scales:{
                    x:{ ...CHART_DEFAULTS.scales.x, min:0, max:carbonMax+500, ticks:{...CHART_DEFAULTS.scales.x.ticks,callback:v=>`${(v/1000).toFixed(1)}k`} },
                    y:{ ticks:{ color:'var(--text-muted)', font:{family:T.mono,size:10} }, grid:{display:false}, border:{display:false} },
                  },
                  plugins:{ ...CHART_DEFAULTS.plugins, legend:{display:false} },
                }}/>
              </div>
            )}
            {carbonChartType === 'doughnut' && (
              <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                <div style={{ width:180, height:180, flexShrink:0 }}>
                  <Doughnut data={carbonDoughnutData} options={{
                    responsive:true, maintainAspectRatio:false,
                    animation:CHART_DEFAULTS.animation,
                    plugins:{ legend:{display:false}, tooltip:CHART_DEFAULTS.plugins.tooltip },
                    cutout:'65%',
                  }}/>
                </div>
                <div style={{ flex:1 }}>
                  {zones.map((z,i) => (
                    <div key={z.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <span style={{ width:10, height:10, borderRadius:2, background:ZONE_PALETTE[i%ZONE_PALETTE.length], flexShrink:0, display:'inline-block' }}/>
                      <span style={{ fontSize:11, color:'var(--text-primary)', flex:1 }}>{z.name}</span>
                      <span style={{ fontFamily:T.mono, fontSize:11, color:'var(--text-muted)' }}>{z.carbonStock.toLocaleString()}t</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SCard>
        </div>

        {/* ── RIGHT ─────────────────────────────────────────────────── */}
        <div className="stack">

          {/* Signal Health — switchable */}
          <SCard delay={150}
            title="Signal Health Overview"
            subtitle="Per-zone signal breakdown"
            actions={
              <ChartToggle value={signalChartType} onChange={setSignalChartType} options={[
                { key:'heatmap',  icon:Activity,   label:'Grid'    },
                { key:'radar',    icon:Activity,   label:'Radar'   },
                { key:'donut',    icon:PieChart,   label:'Avg'     },
                { key:'scatter',  icon:ScatterChart,label:'Scatter'},
              ]}/>
            }>

            {/* Grid heatmap */}
            {signalChartType === 'heatmap' && (
              <div style={{ overflowX:'auto' }}>
                <div style={{ display:'grid', gridTemplateColumns:'100px repeat(4,1fr)', gap:4, minWidth:340 }}>
                  <div/>
                  {['NDVI','Bio','Fire Safe','Moisture'].map(h=>(
                    <div key={h} style={{ fontSize:9, color:'var(--text-muted)', fontFamily:T.mono, fontWeight:700, textAlign:'center', letterSpacing:'.04em', paddingBottom:4 }}>{h}</div>
                  ))}
                  {heatRows.map(row=>(
                    <React.Fragment key={row.zone}>
                      <div style={{ fontSize:11, color:'var(--text-primary)', fontWeight:500, display:'flex', alignItems:'center', paddingRight:4 }}>{row.zone}</div>
                      {[row.ndvi,row.bio,row.thermal,row.moisture].map((v,ci)=>(
                        <div key={ci} className="hm-cell" style={{ background:heatColor(v), color:heatText(v) }}>{v}%</div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:10, fontFamily:T.mono }}>
                  Sources: Copernicus · GBIF · eBird · NASA FIRMS
                </div>
              </div>
            )}

            {/* Radar */}
            {signalChartType === 'radar' && (
              <div className="chart-container vis-card" style={chartAreaStyle}>
                <Radar data={radarData} options={{
                  responsive:true, maintainAspectRatio:false,
                  animation:CHART_DEFAULTS.animation,
                  plugins:CHART_DEFAULTS.plugins,
                  scales:{
                    r:{
                      min:0, max:100,
                      ticks:{ color:'var(--text-muted)', font:{family:T.mono,size:8}, stepSize:25, backdropColor:'transparent' },
                      grid:{ color:'var(--chart-grid)' },
                      pointLabels:{ color:'var(--text-muted)', font:{family:T.mono,size:9} },
                      angleLines:{ color:'var(--chart-grid)' },
                    }
                  }
                }}/>
              </div>
            )}

            {/* Donut average */}
            {signalChartType === 'donut' && (
              <div style={{ display:'flex', gap:20, alignItems:'center' }}>
                <div style={{ width:160, height:160, flexShrink:0 }}>
                  <Doughnut data={doughnutData} options={{
                    responsive:true, maintainAspectRatio:false,
                    animation:CHART_DEFAULTS.animation,
                    plugins:{ legend:{display:false}, tooltip:CHART_DEFAULTS.plugins.tooltip },
                    cutout:'60%',
                  }}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:10, fontFamily:T.mono, fontWeight:600 }}>SYSTEM AVG</div>
                  {[
                    { label:'NDVI',        val:avgSignals.ndvi,     color:T.green  },
                    { label:'Biodiversity',val:avgSignals.bio,      color:'#0EA58C'},
                    { label:'Fire Safety', val:avgSignals.fire,     color:T.red    },
                    { label:'Moisture',    val:avgSignals.moisture, color:T.blue   },
                    { label:'Cover Health',val:avgSignals.cover,    color:T.purple },
                  ].map(s=>(
                    <div key={s.label} style={{ marginBottom:7 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <span style={{ fontSize:10, color:'var(--text-primary)' }}>{s.label}</span>
                        <span style={{ fontFamily:T.mono, fontSize:10, color:s.color, fontWeight:700 }}>{s.val}%</span>
                      </div>
                      <div style={{ height:3, background:'var(--bg-surface)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ width:`${s.val}%`, height:'100%', background:s.color, borderRadius:2, transition:'width .7s ease' }}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scatter — FHI vs NDVI */}
            {signalChartType === 'scatter' && (
              <div>
                <div className="chart-container vis-card" style={{ height:200 }}>
                  <Scatter data={scatterData} options={{
                    responsive:true, maintainAspectRatio:false,
                    animation:CHART_DEFAULTS.animation,
                    plugins:{
                      legend:{ display:false },
                      tooltip:{
                        ...CHART_DEFAULTS.plugins.tooltip,
                        callbacks:{
                          label: ctx => {
                            const raw = ctx.raw
                            return ` ${raw.label}: NDVI ${raw.x}% → FHI ${raw.y}`
                          }
                        }
                      }
                    },
                    scales:{
                      x:{ ...CHART_DEFAULTS.scales.x, min:0, max:100, title:{ display:true, text:'NDVI %', color:'var(--text-muted)', font:{family:T.mono,size:10} } },
                      y:{ ...CHART_DEFAULTS.scales.y, title:{ display:true, text:'FHI Score', color:'var(--text-muted)', font:{family:T.mono,size:10} } },
                    }
                  }}/>
                </div>
                <div style={{ fontSize:9, color:'var(--text-muted)', marginTop:8, fontFamily:T.mono }}>
                  Each dot = one zone. Strong NDVI → higher FHI correlation expected.
                </div>
              </div>
            )}
          </SCard>

          {/* 7-Day Forecast — zone selector */}
          <SCard delay={210}
            title={`Predicted FHI — ${fzOne.name}`}
            subtitle="14-day history + 7-day AI forecast"
            actions={
              <div style={{ display:'flex', gap:4 }}>
                {zones.map(z=>(
                  <button key={z.id} className={`forecast-zone-btn ${fzId===z.id?'active':''}`}
                    onClick={()=>setForecastZoneId(z.id)}>
                    {z.name.split('-')[0]}
                  </button>
                ))}
              </div>
            }>
            <div className="chart-container vis-card" style={{ height:210 }}>
              <Line data={forecastData} options={{
                ...CHART_DEFAULTS,
                scales:{
                  x:{ ...CHART_DEFAULTS.scales.x, ticks:{...CHART_DEFAULTS.scales.x.ticks,maxTicksLimit:8} },
                  y:{ ...CHART_DEFAULTS.scales.y, min:0, max:100 },
                },
              }}/>
            </div>
            <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:T.red, display:'inline-block' }}/>
              <span style={{ fontSize:11, color:T.red, fontWeight:600 }}>
                Tipping point risk: {fzOne.name} (FHI: {fzOne.fhi})
              </span>
              <span className={`badge badge-${fzOne.status}`} style={{ fontSize:8, marginLeft:'auto' }}>
                {fzOne.status.toUpperCase()}
              </span>
            </div>
          </SCard>
        </div>
      </div>
    </>
  )
}