import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, MapPin, Shield, Clock, Bell, Leaf, Activity, Settings, Save, Camera } from 'lucide-react'
import { useAllZones } from '../hooks/useZoneData'

export default function Profile() {
  const navigate = useNavigate()
  const { zones: zonesMap } = useAllZones()
  const zones = Object.values(zonesMap)

  const [profile, setProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vandrishti_profile') || 'null') || {
        name: 'Forest Ranger',
        email: 'ranger@vandrishti.in',
        role: 'Senior Forest Officer',
        location: 'Uttarakhand, India',
        bio: 'Dedicated to forest conservation and wildlife protection using AI-powered monitoring systems.',
        department: 'Forest Department',
        joinDate: '2024-01-15',
        notifications: true,
        alertEmail: true,
      }
    } catch { return {
      name: 'Forest Ranger',
      email: 'ranger@vandrishti.in',
      role: 'Senior Forest Officer',
      location: 'Uttarakhand, India',
      bio: 'Dedicated to forest conservation and wildlife protection using AI-powered monitoring systems.',
      department: 'Forest Department',
      joinDate: '2024-01-15',
      notifications: true,
      alertEmail: true,
    }}
  })

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setProfile(draft)
    localStorage.setItem('vandrishti_profile', JSON.stringify(draft))
    setEditing(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Stats from zone data
  const totalZones = zones.length
  const alertZones = zones.filter(z => z.status === 'critical' || z.status === 'alert').length
  const healthyZones = zones.filter(z => z.status === 'healthy').length
  const daysSinceJoin = Math.floor((Date.now() - new Date(profile.joinDate).getTime()) / 86400000)

  return (
    <>
      <div className="top-bar">
        <h1 className="page-title">Profile</h1>
        <div className="top-bar-right">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>
            <Settings size={14} /> Settings
          </button>
          {!editing ? (
            <button className="btn btn-primary btn-sm" onClick={() => { setDraft(profile); setEditing(true) }}>
              Edit Profile
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave}>
                <Save size={13} /> Save
              </button>
            </div>
          )}
        </div>
      </div>

      {saved && (
        <div style={{
          background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 12,
          fontSize: 13, color: 'var(--brand-green)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ Profile updated successfully
        </div>
      )}

      <div className="two-col col-60-40" style={{ alignItems: 'start' }}>
        {/* Left Column — Profile Info */}
        <div className="stack">
          <div className="card">
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--brand-green), var(--teal))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 32, color: '#fff', fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(46,204,113,0.25)',
                }}>
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--bg-surface)', border: '2px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  <Camera size={11} style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                {editing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</label>
                      <input className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
                        style={{ width: '100%', marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</label>
                      <input className="input" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })}
                        style={{ width: '100%', marginTop: 4 }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
                      <input className="input" type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })}
                        style={{ width: '100%', marginTop: 4 }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 2 }}>{profile.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--brand-green)', fontWeight: 600, marginBottom: 6 }}>{profile.role}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Mail size={12} /> {profile.email}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <MapPin size={12} /> {profile.location}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <Shield size={12} /> {profile.department}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bio / About */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>About</div>
            {editing ? (
              <div>
                <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bio</label>
                <textarea className="input" value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })}
                  rows={3} style={{ width: '100%', marginTop: 4, resize: 'vertical' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</label>
                    <input className="input" value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })}
                      style={{ width: '100%', marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Department</label>
                    <input className="input" value={draft.department} onChange={e => setDraft({ ...draft, department: e.target.value })}
                      style={{ width: '100%', marginTop: 4 }} />
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{profile.bio}</p>
            )}
          </div>

          {/* Notification Preferences */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Notification Preferences</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={14} style={{ color: 'var(--text-secondary)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Push Notifications</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Get alerts for critical zone events</div>
                  </div>
                </div>
                <button onClick={() => {
                  const updated = { ...profile, notifications: !profile.notifications }
                  setProfile(updated)
                  localStorage.setItem('vandrishti_profile', JSON.stringify(updated))
                }} style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: profile.notifications ? 'var(--brand-green)' : 'var(--border-subtle)',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: profile.notifications ? 21 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={14} style={{ color: 'var(--text-secondary)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Email Alerts</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Receive daily summary via email</div>
                  </div>
                </div>
                <button onClick={() => {
                  const updated = { ...profile, alertEmail: !profile.alertEmail }
                  setProfile(updated)
                  localStorage.setItem('vandrishti_profile', JSON.stringify(updated))
                }} style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: profile.alertEmail ? 'var(--brand-green)' : 'var(--border-subtle)',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: profile.alertEmail ? 21 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column — Activity & Stats */}
        <div className="stack">
          {/* Activity Stats */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Monitoring Activity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--brand-green)' }}>{totalZones}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Zones Monitored</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#DC3545' }}>{alertZones}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Alert Zones</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#2ECC71' }}>{healthyZones}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Healthy Zones</div>
              </div>
              <div style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{daysSinceJoin}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Days Active</div>
              </div>
            </div>
          </div>

          {/* Quick Access */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Quick Access</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { icon: Activity, label: 'Forest Zones', desc: 'View all monitored zones', path: '/zones', color: '#22A95C' },
                { icon: Bell, label: 'Alert Center', desc: 'Check active alerts', path: '/alerts', color: '#DC3545' },
                { icon: Leaf, label: 'Analytics', desc: 'View forest analytics', path: '/analytics', color: '#0EA58C' },
                { icon: Settings, label: 'Settings', desc: 'Configure preferences', path: '/settings', color: 'var(--text-secondary)' },
              ].map(item => (
                <div key={item.path} onClick={() => navigate(item.path)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                >
                  <item.icon size={16} style={{ color: item.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{item.desc}</div>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>→</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session Info */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 10 }}>Session</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> Member since</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {new Date(profile.joinDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={11} /> Access Level</span>
                <span className="badge badge-healthy" style={{ fontSize: 9 }}>ADMIN</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}><Activity size={11} /> Status</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--brand-green)', fontWeight: 600 }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6 }} /> Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
