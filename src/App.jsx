import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Zones from './pages/Zones'
import ZoneDetail from './pages/ZoneDetail'
import Alerts from './pages/Alerts'
import EdgeNodes from './pages/EdgeNodes'
import Analytics from './pages/Analytics'

export default function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/zones" element={<Zones />} />
          <Route path="/zones/:zoneId" element={<ZoneDetail />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/edge-nodes" element={<EdgeNodes />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  )
}
