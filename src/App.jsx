import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Zones from './pages/Zones'
import ZoneDetail from './pages/ZoneDetail'
import Alerts from './pages/Alerts'
import EdgeNodes from './pages/EdgeNodes'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import FetchModal from './components/FetchModal'
import { isCacheStale, getSettings } from './services/dataCache'

export default function App() {
  const [fetchModalOpen, setFetchModalOpen] = useState(false)
  const [autoFetch, setAutoFetch] = useState(false)

  useEffect(() => {
    const settings = getSettings()
    if (settings.autoFetchOnLoad && isCacheStale()) {
      setAutoFetch(true)
      setFetchModalOpen(true)
    }
  }, [])

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
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>

      <FetchModal
        open={fetchModalOpen}
        onClose={() => setFetchModalOpen(false)}
        autoFetch={autoFetch}
      />
    </div>
  )
}