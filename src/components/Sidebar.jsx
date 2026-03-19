import { NavLink, useLocation } from 'react-router-dom'
import { Map, Activity, Bell, TrendingUp, Cpu, Settings, Sun, Moon } from 'lucide-react'
import { useTheme } from '../ThemeContext'

const navItems = [
  { to: '/dashboard', icon: Map, label: 'Dashboard' },
  { to: '/zones', icon: Activity, label: 'Forest Zones' },
  { to: '/alerts', icon: Bell, label: 'Alerts', badge: 3 },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/edge-nodes', icon: Cpu, label: 'Edge Nodes' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const location = useLocation()
  const { theme, toggle } = useTheme()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4C12 4 6 10 6 18c0 4 2 6 4 7l5-3V28h2V22l5 3c2-1 4-3 4-7C26 10 20 4 16 4z"
              fill="#2ECC71" fillOpacity="0.2" stroke="#2ECC71" strokeWidth="1.5" />
            <line x1="16" y1="14" x2="16" y2="28" stroke="#39FF6A" strokeWidth="2" strokeDasharray="2 2" />
            <circle cx="16" cy="14" r="2" fill="#39FF6A" />
            <circle cx="12" cy="17" r="1.2" fill="#39FF6A" fillOpacity="0.5" />
            <circle cx="20" cy="17" r="1.2" fill="#39FF6A" fillOpacity="0.5" />
          </svg>
        </div>
        <h1>VanDrishti</h1>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.to ||
            (item.to === '/zones' && location.pathname.startsWith('/zones'))
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </NavLink>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {/* Theme Toggle */}
        <button
          onClick={toggle}
          className="theme-toggle"
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        <div className="edge-node-status">
          <div className="node-header">
            <Cpu size={14} color="#6B8F72" />
            <span className="node-label">RPi Edge Node</span>
          </div>
          <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
            <span className="pulse-dot"></span>
            <span className="online-tag">ONLINE</span>
          </div>
          <div className="last-sync" style={{ marginTop: 4 }}>last sync: 2 min ago</div>
        </div>
      </div>
    </aside>
  )
}
