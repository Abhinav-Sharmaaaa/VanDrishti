import { useState, useCallback } from 'react'
import {
  ChevronDown, CheckCircle, Send, Phone, Users, AlertTriangle,
  Flame, Droplets, TreePine, Bird, LayoutList, Table2, LayoutGrid,
  AlignJustify, X,
} from 'lucide-react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Filler, Tooltip as ChartTooltip,
} from 'chart.js'
import LoadingSpinner from '../components/LoadingSpinner'
import { useAllZones } from '../hooks/useZoneData'
import { sendDispatchNotification } from '../services/notificationService'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip)

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────
const SEV_COLOR  = { critical:'#DC3545', watch:'#D97706', resolved:'#22A95C', alert:'#EA580C' }
const SEV_BORDER = { critical:'critical-border', watch:'watch-border', resolved:'healthy-border', alert:'critical-border' }

const PROBLEM_META = {
  fire_outbreak:     { label:'Fire Outbreak',      icon:Flame,         color:'#DC3545' },
  thermal_anomaly:   { label:'Thermal Anomaly',     icon:Flame,         color:'#EA580C' },
  biodiversity_loss: { label:'Biodiversity Loss',   icon:Bird,          color:'#0EA58C' },
  moisture_stress:   { label:'Moisture Stress',     icon:Droplets,      color:'#3B82F6' },
  canopy_decline:    { label:'Canopy Decline',      icon:TreePine,      color:'#22A95C' },
}

const GOVT_TEAMS = {
  dfo:        { id:'dfo',        name:'District Forest Officer',          dept:'State Forest Dept.',           contact:'+91-1378-222001', icon:TreePine,      color:'#22A95C' },
  rfo:        { id:'rfo',        name:'Range Forest Officer',             dept:'Forest Range Division',        contact:'+91-1378-222045', icon:TreePine,      color:'#16A34A' },
  fire_dept:  { id:'fire_dept',  name:'State Fire & Emergency Services',  dept:'Uttarakhand Fire Dept.',       contact:'+91-1378-101',    icon:Flame,         color:'#DC3545' },
  ranger:     { id:'ranger',     name:'Forest Ranger Team',               dept:'Field Operations Unit',        contact:'+91-98765-43210', icon:Users,         color:'#D97706' },
  wildlife:   { id:'wildlife',   name:'Wildlife Warden',                  dept:'Wildlife Crime Control',       contact:'+91-1378-222089', icon:Bird,          color:'#0EA58C' },
  sdrf:       { id:'sdrf',       name:'State Disaster Response Force',    dept:'SDRF Uttarakhand',             contact:'+91-1378-1077',   icon:AlertTriangle, color:'#7C3AED' },
  irrigation: { id:'irrigation', name:'State Irrigation Dept.',           dept:'Water Resource Division',      contact:'+91-1378-222110', icon:Droplets,      color:'#3B82F6' },
}

// ─────────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────────
function classifyProblems(zone) {
  const p = []
  if (zone.fire.count > 5 || zone.fhi < 25)
    p.push({ type:'fire_outbreak',     ...PROBLEM_META.fire_outbreak,     severity:'critical', teams:[GOVT_TEAMS.fire_dept,GOVT_TEAMS.ranger,GOVT_TEAMS.sdrf],     description:`${zone.fire.count} thermal anomalies detected. FHI: ${zone.fhi}. Immediate ground verification required.` })
  if (zone.signals.thermalRisk >= 30 && zone.fire.count <= 5 && zone.fhi >= 25)
    p.push({ type:'thermal_anomaly',   ...PROBLEM_META.thermal_anomaly,   severity:'watch',    teams:[GOVT_TEAMS.ranger,GOVT_TEAMS.rfo],                           description:`Thermal risk index at ${zone.signals.thermalRisk}%. ${zone.fire.count} anomalies detected.` })
  if (zone.signals.biodiversity < 50)
    p.push({ type:'biodiversity_loss', ...PROBLEM_META.biodiversity_loss, severity:'watch',    teams:[GOVT_TEAMS.wildlife,GOVT_TEAMS.rfo],                         description:`Biodiversity index at ${zone.signals.biodiversity}%. ${zone.species.birdSpecies} bird species observed.` })
  if (zone.signals.moisture < 40)
    p.push({ type:'moisture_stress',   ...PROBLEM_META.moisture_stress,   severity:'watch',    teams:[GOVT_TEAMS.irrigation,GOVT_TEAMS.rfo],                       description:`Moisture index at ${zone.signals.moisture}%. Prolonged deficit risk.` })
  if (zone.signals.ndvi < 40 || zone.signals.coverHealth < 40)
    p.push({ type:'canopy_decline',    ...PROBLEM_META.canopy_decline,    severity:zone.signals.ndvi < 25 ? 'critical' : 'watch', teams:[GOVT_TEAMS.dfo,GOVT_TEAMS.rfo], description:`NDVI at ${zone.signals.ndvi}%. Cover health at ${zone.signals.coverHealth}%.` })
  if (p.length >= 3) p.forEach(x => { if (!x.teams.find(t => t.id==='sdrf')) x.teams.push(GOVT_TEAMS.sdrf) })
  return p
}

function buildAlerts(zones) {
  const out = []; let id = 1
  const t = () => new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})+' IST'
  for (const z of zones) {
    const problems = classifyProblems(z)
    if (!problems.length) {
      if (z.status==='healthy' && z.fhi>=70)
        out.push({ id:id++, severity:'resolved', zone:z.name, zoneId:z.id, fhi:z.fhi, problemTypes:[], problems:[], teams:[], msg:`FHI stable at ${z.fhi}. All signals within healthy range.`, time:t(), recommended:'No action needed.', resolved:true, sources:['All APIs'] })
      continue
    }
    const allTeams=[]; const seen=new Set()
    for (const p of problems) for (const tm of p.teams) if (!seen.has(tm.id)) { allTeams.push(tm); seen.add(tm.id) }
    out.push({
      id:id++, severity:problems.some(p=>p.severity==='critical')?'critical':'watch',
      zone:z.name, zoneId:z.id, fhi:z.fhi,
      problemTypes:problems.map(p=>p.type), problems, teams:allTeams,
      msg:`${problems.length} problem${problems.length>1?'s':''} detected — ${problems.map(p=>p.label).join(' · ')}`,
      time:t(), recommended:problems[0].description, resolved:false,
      sources:['NASA FIRMS','Copernicus','GBIF','eBird','OpenWeatherMap'].slice(0,problems.length+1),
    })
  }
  return out
}

// ─────────────────────────────────────────────────────────────────
// Small reusables
// ─────────────────────────────────────────────────────────────────
function MiniChart({ fhi, color='#DC3545' }) {
  const labels = Array.from({length:14},(_,i)=>`D${i+1}`)
  const s=fhi+20; const data=labels.map((_,i)=>Math.max(5,s-i*((s-fhi)/14)+(Math.random()*4-2)))
  return (
    <div style={{height:70}}>
      <Line data={{labels,datasets:[{data,borderColor:color,borderWidth:1.5,pointRadius:0,fill:true,backgroundColor:color+'14',tension:.3}]}}
        options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false,min:0,max:100}}}}/>
    </div>
  )
}

function ProblemChip({ type, label, color, icon:Icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      display:'inline-flex',alignItems:'center',gap:4,
      fontSize:9,padding:'3px 9px',borderRadius:20,fontWeight:700,cursor:'pointer',
      background:active ? color+'30' : color+'14',
      color, fontFamily:'var(--font-mono)',
      border:`1.5px solid ${active ? color : color+'33'}`,
      transition:'all .16s ease',
      transform:active?'scale(1.06)':'scale(1)',
      boxShadow:active?`0 0 8px ${color}44`:'none',
    }}>
      <Icon size={9}/>{label.toUpperCase()}
    </button>
  )
}

function DispatchBtn({ team, dispatched, onDispatch }) {
  const Icon=team.icon; const sent=dispatched.has(team.id)
  return (
    <button onClick={()=>!sent&&onDispatch(team.id)} style={{
      display:'flex',alignItems:'center',gap:5,
      padding:'4px 10px',borderRadius:8,fontSize:10,fontWeight:600,
      border:`1.5px solid ${sent?team.color:team.color+'44'}`,
      background:sent?team.color+'18':'transparent',
      color:sent?team.color:'var(--text-muted)',
      cursor:sent?'default':'pointer',
      transition:'all .16s',fontFamily:'var(--font-mono)',whiteSpace:'nowrap',
    }}>
      <Icon size={10}/>{sent?'✓ Sent':'Dispatch'}
    </button>
  )
}

function TeamRow({ team, dispatched, onDispatch }) {
  const Icon=team.icon; const sent=dispatched.has(team.id)
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 12px',borderRadius:10,background:sent?team.color+'0E':'var(--bg-surface)',border:`1px solid ${sent?team.color+'44':'var(--border)'}`,transition:'all .18s'}}>
      <div style={{display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:28,height:28,borderRadius:7,background:team.color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon size={13} color={team.color}/></div>
        <div>
          <div style={{fontSize:11,fontWeight:600,color:'var(--text-primary)'}}>{team.name}</div>
          <a href={`tel:${team.contact}`} style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',textDecoration:'none',display:'flex',alignItems:'center',gap:3}}><Phone size={8}/>{team.contact}</a>
        </div>
      </div>
      <DispatchBtn team={team} dispatched={dispatched} onDispatch={onDispatch}/>
    </div>
  )
}

function TeamDot({ team, dispatched, onDispatch }) {
  const Icon=team.icon; const sent=dispatched.has(team.id)
  return (
    <div title={`${team.name} — click to dispatch`} onClick={()=>onDispatch(team.id)}
      style={{width:26,height:26,borderRadius:7,background:sent?team.color+'28':team.color+'12',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:`1px solid ${sent?team.color+'66':'transparent'}`,transition:'all .16s',flexShrink:0}}>
      <Icon size={11} color={team.color}/>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Alert detail panel (shared by list view)
// ─────────────────────────────────────────────────────────────────
function AlertDetail({ alert, dispatched, onDispatch }) {
  const ad = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
  return (
    <div className="alert-detail" style={{animation:'expandDown .22s ease'}}>
      {alert.problems.length > 0 && (
        <div style={{marginBottom:14}}>
          <div className="card-title" style={{marginBottom:8}}>Detected Problems</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {alert.problems.map(p => { const PI=p.icon; return (
              <div key={p.type} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 12px',borderRadius:10,background:p.color+'0C',border:`1px solid ${p.color}33`}}>
                <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:p.color+'20',display:'flex',alignItems:'center',justifyContent:'center'}}><PI size={13} color={p.color}/></div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:p.color,marginBottom:2}}>{p.label}</div>
                  <div style={{fontSize:11,color:'var(--text-secondary)',lineHeight:1.5}}>{p.description}</div>
                </div>
              </div>
            )})}
          </div>
        </div>
      )}
      <div className="alert-detail-body">
        <div>
          <div className="card-title" style={{marginBottom:8}}>FHI Trend</div>
          <MiniChart fhi={alert.fhi} color={SEV_COLOR[alert.severity]}/>
          <div style={{fontSize:9,color:'var(--text-muted)',marginTop:4,fontFamily:'var(--font-mono)'}}>FHI {alert.fhi} · {alert.severity.toUpperCase()}</div>
        </div>
        <div>
          <div className="card-title" style={{marginBottom:8}}>Recommended Action</div>
          <p style={{fontSize:12,color:'var(--text-secondary)',lineHeight:1.6}}>{alert.recommended}</p>
          <div style={{marginTop:8,fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',padding:'5px 10px',background:'var(--bg-surface)',borderRadius:8}}>{alert.zone} · FHI {alert.fhi} · {alert.time}</div>
        </div>
      </div>
      {alert.teams.length > 0 && (
        <div style={{marginTop:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
            <div className="card-title">Dispatch to Government Teams</div>
            <button onClick={e=>{e.stopPropagation();alert.teams.forEach(t=>{if(!ad.has(t.id))onDispatch(alert.id,t.id,alert.zone,alert)})}}
              style={{display:'flex',alignItems:'center',gap:5,padding:'4px 12px',borderRadius:8,fontSize:10,fontWeight:700,cursor:'pointer',background:'var(--text-primary)',color:'#7ED9A0',border:'none',fontFamily:'var(--font-mono)'}}>
              <Send size={10}/> Dispatch All
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:5}}>
            {alert.teams.map(t=><TeamRow key={t.id} team={t} dispatched={ad} onDispatch={id=>onDispatch(alert.id,id,alert.zone,alert)}/>)}
          </div>
        </div>
      )}
      <div className="alert-detail-actions" style={{marginTop:12}}>
        <button className="btn btn-primary btn-sm"><CheckCircle size={13}/> Acknowledge</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// VIEW: LIST
// ─────────────────────────────────────────────────────────────────
function ListView({ alerts, expanded, setExpanded, dispatched, onDispatch, onChipClick, activeProblem }) {
  return (
    <div className="alert-list">
      {alerts.map((alert,idx) => {
        const ad = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
        const allDone = alert.teams.length>0 && alert.teams.every(t=>ad.has(t.id))
        const isOpen = expanded===alert.id
        return (
          <div key={alert.id} className={`alert-row ${SEV_BORDER[alert.severity]}`}
            style={{animationDelay:`${idx*50}ms`,animation:'alertSlideIn .32s ease both'}}
            onClick={()=>setExpanded(isOpen?null:alert.id)}>
            <div className="alert-row-main">
              <span className="alert-row-icon" style={{background:SEV_COLOR[alert.severity]}}/>
              <div className="alert-row-body">
                <div className="alert-row-zone" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  {alert.zone}
                  {alert.resolved && <span className="badge badge-resolved" style={{fontSize:8}}>RESOLVED</span>}
                  {allDone && !alert.resolved && <span style={{fontSize:8,padding:'1px 7px',borderRadius:10,background:'#7C3AED18',color:'#7C3AED',fontFamily:'var(--font-mono)',fontWeight:700}}>ALL DISPATCHED</span>}
                </div>
                <div className="alert-row-msg">{alert.msg}</div>
                {alert.problems.length>0 && (
                  <div style={{display:'flex',gap:4,marginTop:5,flexWrap:'wrap'}}>
                    {alert.problems.map(p=>(
                      <ProblemChip key={p.type} {...p} active={activeProblem===p.type} onClick={e=>{e.stopPropagation();onChipClick(p.type)}}/>
                    ))}
                  </div>
                )}
                {alert.sources?.length>0 && (
                  <div style={{display:'flex',gap:3,marginTop:4,flexWrap:'wrap'}}>
                    {alert.sources.map(s=><span key={s} style={{fontSize:8,padding:'1px 6px',borderRadius:8,background:'rgba(34,169,92,.1)',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{s}</span>)}
                  </div>
                )}
              </div>
              <div className="alert-row-right">
                <span className="alert-row-time">{alert.time}</span>
                <div style={{display:'flex',gap:4,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  {!alert.resolved && alert.teams.slice(0,2).map(t=>(
                    <DispatchBtn key={t.id} team={t} dispatched={ad} onDispatch={id=>onDispatch(alert.id,id,alert.zone,alert)}/>
                  ))}
                </div>
                <ChevronDown size={14} className={`alert-expand-icon ${isOpen?'open':''}`}/>
              </div>
            </div>
            {isOpen && <AlertDetail alert={alert} dispatched={dispatched} onDispatch={onDispatch}/>}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// VIEW: TABLE
// ─────────────────────────────────────────────────────────────────
function TableView({ alerts, dispatched, onDispatch, onChipClick, activeProblem }) {
  return (
    <div className="card" style={{padding:0,overflow:'hidden'}}>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'var(--bg-surface)',borderBottom:'1px solid #E0E8E2'}}>
              {['Zone','Severity','Problem Types','FHI','Teams','Time','Action'].map(h=>(
                <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:9,color:'var(--text-muted)',fontWeight:700,fontFamily:'var(--font-mono)',letterSpacing:'.06em',whiteSpace:'nowrap'}}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert,idx) => {
              const ad = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
              return (
                <tr key={alert.id}
                  style={{borderLeft:`3px solid ${SEV_COLOR[alert.severity]}`,background:idx%2===0?'#fff':'#FAFCFA',animation:`alertSlideIn .28s ease ${idx*35}ms both`,transition:'background .12s',cursor:'default'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-surface)'}
                  onMouseLeave={e=>e.currentTarget.style.background=idx%2===0?'#fff':'#FAFCFA'}>
                  <td style={{padding:'10px 14px'}}>
                    <div style={{fontWeight:600,fontSize:12,color:'var(--text-primary)'}}>{alert.zone}</div>
                    <div style={{fontSize:9,color:'var(--text-faint)',fontFamily:'var(--font-mono)'}}>{alert.zoneId}</div>
                  </td>
                  <td style={{padding:'10px 14px'}}>
                    <span className={`badge badge-${alert.severity}`} style={{fontSize:8}}>{alert.severity.toUpperCase()}</span>
                  </td>
                  <td style={{padding:'10px 14px'}}>
                    <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                      {alert.problems.length>0
                        ? alert.problems.map(p=><ProblemChip key={p.type} {...p} active={activeProblem===p.type} onClick={()=>onChipClick(p.type)}/>)
                        : <span style={{fontSize:9,color:'#22A95C',fontFamily:'var(--font-mono)'}}>✓ Healthy</span>}
                    </div>
                  </td>
                  <td style={{padding:'10px 14px',textAlign:'center'}}>
                    <span style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:15,color:SEV_COLOR[alert.severity]}}>{alert.fhi}</span>
                  </td>
                  <td style={{padding:'10px 14px'}}>
                    <div style={{display:'flex',gap:4,alignItems:'center'}}>
                      {alert.teams.slice(0,4).map(t=><TeamDot key={t.id} team={t} dispatched={ad} onDispatch={id=>onDispatch(alert.id,id,alert.zone,alert)}/>)}
                      {alert.teams.length>4 && <span style={{fontSize:9,color:'var(--text-muted)'}}>+{alert.teams.length-4}</span>}
                    </div>
                  </td>
                  <td style={{padding:'10px 14px'}}>
                    <span style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>{alert.time}</span>
                  </td>
                  <td style={{padding:'10px 14px'}}>
                    {!alert.resolved
                      ? <button onClick={()=>alert.teams.forEach(t=>{if(!ad.has(t.id))onDispatch(alert.id,t.id,alert.zone,alert)})}
                          className="btn btn-primary btn-sm" style={{fontSize:9,padding:'4px 10px',whiteSpace:'nowrap'}}>
                          <Send size={9}/> Dispatch All
                        </button>
                      : <span style={{fontSize:9,color:'#22A95C',fontFamily:'var(--font-mono)'}}>✓ Resolved</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {alerts.length===0 && <div style={{textAlign:'center',padding:40,color:'var(--text-muted)',fontSize:13}}>No alerts match the current filter.</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// VIEW: CARDS
// ─────────────────────────────────────────────────────────────────
function CardsView({ alerts, dispatched, onDispatch, onChipClick, activeProblem }) {
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))',gap:14}}>
      {alerts.map((alert,idx) => {
        const ad = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
        const allDone = alert.teams.length>0 && alert.teams.every(t=>ad.has(t.id))
        return (
          <div key={alert.id} className="card" style={{padding:'18px 20px',borderLeft:`4px solid ${SEV_COLOR[alert.severity]}`,animation:`alertSlideIn .38s ease ${idx*55}ms both`,transition:'box-shadow .18s,transform .18s',cursor:'default'}}
            onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,.09)';e.currentTarget.style.transform='translateY(-2px)'}}
            onMouseLeave={e=>{e.currentTarget.style.boxShadow='';e.currentTarget.style.transform=''}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:10}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text-primary)',marginBottom:4}}>{alert.zone}</div>
                <span className={`badge badge-${alert.severity}`} style={{fontSize:8}}>{alert.severity.toUpperCase()}</span>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontFamily:'var(--font-mono)',fontWeight:800,fontSize:24,color:SEV_COLOR[alert.severity],lineHeight:1}}>{alert.fhi}</div>
                <div style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>FHI</div>
              </div>
            </div>
            {/* FHI progress */}
            <div style={{height:3,background:'#E8F1EA',borderRadius:2,marginBottom:12,overflow:'hidden'}}>
              <div style={{width:`${alert.fhi}%`,height:'100%',background:SEV_COLOR[alert.severity],borderRadius:2,transition:'width .7s ease'}}/>
            </div>
            {/* Problem chips */}
            {alert.problems.length>0 && (
              <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
                {alert.problems.map(p=><ProblemChip key={p.type} {...p} active={activeProblem===p.type} onClick={()=>onChipClick(p.type)}/>)}
              </div>
            )}
            {/* Team dots */}
            {alert.teams.length>0 && (
              <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:12,padding:'7px 10px',background:'var(--bg-surface)',borderRadius:8}}>
                <span style={{fontSize:8,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginRight:2}}>TEAMS</span>
                {alert.teams.slice(0,5).map(t=><TeamDot key={t.id} team={t} dispatched={ad} onDispatch={id=>onDispatch(alert.id,id,alert.zone,alert)}/>)}
                {allDone && <span style={{marginLeft:'auto',fontSize:8,color:'#7C3AED',fontFamily:'var(--font-mono)',fontWeight:700}}>ALL SENT ✓</span>}
              </div>
            )}
            <div style={{display:'flex',gap:6}}>
              {!alert.resolved && (
                <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center',fontSize:10}}
                  onClick={()=>alert.teams.forEach(t=>{if(!ad.has(t.id))onDispatch(alert.id,t.id,alert.zone,alert)})}>
                  <Send size={10}/> Dispatch All
                </button>
              )}
              <button className="btn btn-ghost btn-sm" style={{fontSize:10}}><CheckCircle size={10}/> Ack</button>
            </div>
            <div style={{marginTop:8,fontSize:9,color:'var(--text-faint)',fontFamily:'var(--font-mono)',textAlign:'right'}}>{alert.time}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// VIEW: COMPACT
// ─────────────────────────────────────────────────────────────────
function CompactView({ alerts, dispatched, onDispatch, onChipClick, activeProblem }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      {alerts.map((alert,idx) => {
        const ad = dispatched[alert.id] ? new Set(dispatched[alert.id]) : new Set()
        return (
          <div key={alert.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:8,background:'var(--bg-card)',border:'1px solid var(--border)',borderLeft:`3px solid ${SEV_COLOR[alert.severity]}`,animation:`alertSlideIn .22s ease ${idx*25}ms both`,transition:'background .12s'}}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg-surface)'}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <span style={{width:7,height:7,borderRadius:'50%',background:SEV_COLOR[alert.severity],flexShrink:0}}/>
            <span style={{fontWeight:600,fontSize:12,color:'var(--text-primary)',minWidth:110,flexShrink:0}}>{alert.zone}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:SEV_COLOR[alert.severity],fontWeight:700,minWidth:28,flexShrink:0}}>{alert.fhi}</span>
            <div style={{display:'flex',gap:3,flex:1,flexWrap:'wrap'}}>
              {alert.problems.map(p=><ProblemChip key={p.type} {...p} active={activeProblem===p.type} onClick={()=>onChipClick(p.type)}/>)}
              {!alert.problems.length && <span style={{fontSize:9,color:'#22A95C',fontFamily:'var(--font-mono)'}}>✓ Healthy</span>}
            </div>
            <div style={{display:'flex',gap:3,alignItems:'center',flexShrink:0}}>
              {alert.teams.slice(0,4).map(t=><TeamDot key={t.id} team={t} dispatched={ad} onDispatch={id=>onDispatch(alert.id,id,alert.zone,alert)}/>)}
              <span style={{fontSize:9,color:'var(--text-faint)',fontFamily:'var(--font-mono)',marginLeft:6,whiteSpace:'nowrap'}}>{alert.time}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────
export default function Alerts() {
  const { zones: zonesMap, loading } = useAllZones(60_000)
  const [expanded,       setExpanded]       = useState(null)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [problemFilter,  setProblemFilter]  = useState(null)
  const [viewMode,       setViewMode]       = useState('list')
  const [dispatched,     setDispatched]     = useState({})
  const [dispatchLog,    setDispatchLog]    = useState([])

  const handleDispatch = useCallback((alertId, teamId, zone, alert) => {
    setDispatched(prev => {
      const cur = prev[alertId] ? new Set(prev[alertId]) : new Set()
      cur.add(teamId); return { ...prev, [alertId]: cur }
    })
    const team = Object.values(GOVT_TEAMS).find(t => t.id === teamId)
    setDispatchLog(prev => [{
      id:   Date.now(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      team: team.name, dept: team.dept, zone, color: team.color,
    }, ...prev.slice(0, 9)])

    // Send Telegram + browser notification with full context
    if (alert) {
      sendDispatchNotification(team, alert).catch(err =>
        console.error('[Alerts] Dispatch notification error:', err)
      )
    }
  }, [])

  const handleChipClick = useCallback(type => {
    setProblemFilter(prev => prev===type ? null : type)
  }, [])

  if (loading || !Object.keys(zonesMap).length) return <LoadingSpinner message="Loading alerts…"/>

  const alerts = buildAlerts(Object.values(zonesMap))

  const filtered = alerts.filter(a => {
    const sevOk = severityFilter==='all' ? true : severityFilter==='resolved' ? a.resolved : a.severity===severityFilter && !a.resolved
    const probOk = !problemFilter ? true : a.problemTypes.includes(problemFilter)
    return sevOk && probOk
  })

  const critCount  = alerts.filter(a=>a.severity==='critical').length
  const watchCount = alerts.filter(a=>a.severity==='watch'&&!a.resolved).length
  const resvCount  = alerts.filter(a=>a.resolved).length
  const dispCount  = Object.values(dispatched).reduce((s,set)=>s+set.size,0)
  const presentProbs = [...new Set(alerts.flatMap(a=>a.problemTypes))]

  const VIEWS = [
    {key:'list',    Icon:LayoutList,   label:'List'},
    {key:'table',   Icon:Table2,       label:'Table'},
    {key:'cards',   Icon:LayoutGrid,   label:'Cards'},
    {key:'compact', Icon:AlignJustify, label:'Compact'},
  ]

  return (
    <>
      <style>{`
        @keyframes alertSlideIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes expandDown   { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dispatchPop  { 0%{transform:scale(.82);opacity:0} 65%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
        .v-btn{border:none;cursor:pointer;display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:7px;font-size:11px;font-weight:500;transition:all .14s;font-family:var(--font-body)}
        .v-btn.on{background:#1A2E1E;color:#7ED9A0}
        .v-btn:not(.on){background:transparent;color:#6B8872}
        .v-btn:not(.on):hover{background:#F0F5F1;color:#1A2E1E}
        .s-card{cursor:pointer;transition:all .18s ease}
        .s-card:hover{transform:translateY(-2px);box-shadow:0 4px 18px rgba(0,0,0,.08)}
        .s-card.active-filter{box-shadow:0 0 0 2px currentColor}
        .dispatch-entry{animation:dispatchPop .28s ease}
        .prob-legend-btn{width:100%;display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;border:none;cursor:pointer;transition:background .14s;text-align:left;background:transparent}
        .prob-legend-btn:hover{background:#F0F5F1}
      `}</style>

      {/* Top bar */}
      <div className="top-bar">
        <h1 className="page-title">Alert Center</h1>
        <div className="top-bar-right">
          <div style={{display:'flex',gap:2,background:'var(--bg-surface)',borderRadius:9,padding:3}}>
            {VIEWS.map(({key,Icon,label})=>(
              <button key={key} className={`v-btn ${viewMode===key?'on':''}`} onClick={()=>setViewMode(key)} title={label}>
                <Icon size={13}/>{label}
              </button>
            ))}
          </div>
          <div className="filter-pills">
            {['all','critical','watch','resolved'].map(f=>(
              <button key={f} className={`filter-pill ${severityFilter===f?'active':''}`} onClick={()=>setSeverityFilter(f)}>
                {f[0].toUpperCase()+f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm">Export</button>
        </div>
      </div>

      {/* Stat cards — clickable for severity filter */}
      <div className="stats-row">
        {[
          {label:'Active',     val:alerts.filter(a=>!a.resolved).length, color:'#D97706', f:'all'},
          {label:'Critical',   val:critCount,  color:'#DC3545', f:'critical', sub:'NASA FIRMS'},
          {label:'Watch',      val:watchCount, color:'#D97706', f:'watch'},
          {label:'Resolved',   val:resvCount,  color:'#22A95C', f:'resolved'},
          {label:'Dispatched', val:dispCount,  color:'#7C3AED'},
        ].map(({label,val,color,f,sub})=>(
          <div key={label} className={`stat-card s-card`} style={{outline:f&&severityFilter===f?`2px solid ${color}`:'none',outlineOffset:2}} onClick={()=>f&&setSeverityFilter(prev=>prev===f?'all':f)}>
            <div className="stat-card-value" style={{color}}>{val}</div>
            <div className="stat-card-label">{label}</div>
            {sub&&<div style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Problem-type filter bar */}
      {presentProbs.length>0 && (
        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',padding:'10px 14px',marginBottom:14,background:'var(--bg-surface)',borderRadius:10,border:'1px solid var(--border)',animation:'alertSlideIn .28s ease'}}>
          <span style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',fontWeight:600,marginRight:2}}>FILTER BY PROBLEM</span>
          {presentProbs.map(type => {
            const meta=PROBLEM_META[type]; if(!meta) return null
            return <ProblemChip key={type} type={type} {...meta} active={problemFilter===type} onClick={()=>handleChipClick(type)}/>
          })}
          {problemFilter && (
            <>
              <button onClick={()=>setProblemFilter(null)}
                style={{border:'none',cursor:'pointer',background:'rgba(220,53,69,.1)',color:'#DC3545',borderRadius:6,padding:'3px 8px',fontSize:10,display:'flex',alignItems:'center',gap:4,fontFamily:'var(--font-mono)',transition:'all .14s'}}>
                <X size={9}/> Clear
              </button>
              <span style={{marginLeft:'auto',fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
                {filtered.length} alert{filtered.length!==1?'s':''} match
              </span>
            </>
          )}
        </div>
      )}

      {/* Main layout */}
      <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>

        {/* Alert area */}
        <div style={{flex:1,minWidth:0}}>
          {filtered.length===0 && (
            <div style={{textAlign:'center',padding:'48px 0',color:'var(--text-muted)',fontSize:13,animation:'alertSlideIn .3s ease'}}>
              <div style={{fontSize:30,marginBottom:10}}>🌿</div>
              No alerts match the current filter.
            </div>
          )}
          {viewMode==='list'    && filtered.length>0 && <ListView    alerts={filtered} expanded={expanded} setExpanded={setExpanded} dispatched={dispatched} onDispatch={handleDispatch} onChipClick={handleChipClick} activeProblem={problemFilter}/>}
          {viewMode==='table'   && filtered.length>0 && <TableView   alerts={filtered} dispatched={dispatched} onDispatch={handleDispatch} onChipClick={handleChipClick} activeProblem={problemFilter}/>}
          {viewMode==='cards'   && filtered.length>0 && <CardsView   alerts={filtered} dispatched={dispatched} onDispatch={handleDispatch} onChipClick={handleChipClick} activeProblem={problemFilter}/>}
          {viewMode==='compact' && filtered.length>0 && <CompactView alerts={filtered} dispatched={dispatched} onDispatch={handleDispatch} onChipClick={handleChipClick} activeProblem={problemFilter}/>}
        </div>

        {/* Sidebar */}
        <div style={{width:248,flexShrink:0,position:'sticky',top:16,display:'flex',flexDirection:'column',gap:12}}>

          {/* Dispatch log */}
          <div className="card" style={{padding:'14px 16px'}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}>
              <Send size={13} color="#22A95C"/>
              <div className="card-title" style={{margin:0}}>Dispatch Log</div>
            </div>
            {dispatchLog.length===0
              ? <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center',padding:'16px 0',fontFamily:'var(--font-mono)'}}>No dispatches yet.<br/><span style={{fontSize:9}}>Dispatch a team to log activity.</span></div>
              : <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {dispatchLog.map(e=>(
                    <div key={e.id} className="dispatch-entry" style={{padding:'7px 10px',borderRadius:9,background:e.color+'0C',border:`1px solid ${e.color}33`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:2}}>
                        <span style={{fontSize:10,fontWeight:700,color:e.color}}>{e.team}</span>
                        <span style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{e.time}</span>
                      </div>
                      <div style={{fontSize:9.5,color:'var(--text-secondary)'}}>→ <strong>{e.zone}</strong></div>
                      <div style={{fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:1}}>{e.dept}</div>
                    </div>
                  ))}
                </div>
            }
            {dispCount>0 && (
              <div style={{marginTop:10,paddingTop:8,borderTop:'1px solid #E8F1EA',fontSize:9,color:'var(--text-muted)',fontFamily:'var(--font-mono)',textAlign:'center'}}>
                {dispCount} dispatch{dispCount!==1?'es':''} this session
              </div>
            )}
          </div>

          {/* Problem type legend — clickable */}
          <div className="card" style={{padding:'14px 16px'}}>
            <div className="card-title" style={{marginBottom:10}}>Problem Types</div>
            {Object.entries(PROBLEM_META).map(([type,{label,icon:Icon,color}]) => {
              const count=alerts.filter(a=>a.problemTypes.includes(type)).length
              if(!count) return null
              return (
                <button key={type} className="prob-legend-btn"
                  style={{background:problemFilter===type?color+'12':undefined}}
                  onClick={()=>handleChipClick(type)}>
                  <div style={{width:24,height:24,borderRadius:6,background:color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon size={11} color={color}/></div>
                  <div style={{flex:1,fontSize:10,fontWeight:600,color:'var(--text-primary)'}}>{label}</div>
                  <span style={{fontSize:10,fontWeight:700,color,fontFamily:'var(--font-mono)'}}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Response teams */}
          <div className="card" style={{padding:'14px 16px'}}>
            <div className="card-title" style={{marginBottom:10}}>Response Teams</div>
            {Object.values(GOVT_TEAMS).map(team => {
              const TI=team.icon
              return (
                <div key={team.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:'1px solid var(--border)'}}>
                  <div style={{width:22,height:22,borderRadius:5,background:team.color+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><TI size={10} color={team.color}/></div>
                  <div>
                    <div style={{fontSize:9.5,fontWeight:600,color:'var(--text-primary)'}}>{team.name}</div>
                    <div style={{fontSize:8,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{team.dept}</div>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      </div>
    </>
  )
}