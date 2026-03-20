import { useEffect, useRef, useState, useCallback } from 'react'

const WS_URL = import.meta.env.VITE_BACKEND_WS || 'ws://localhost:3001'

/**
 * Connects to backend WebSocket and receives live snapshots from RPi nodes.
 * Each snapshot has the same shape as fetchZoneData() in dataService.js,
 * so it can be merged directly into the zone cache.
 */
export function useEdgeData() {
  const [snapshots,  setSnapshots]  = useState({})   // zoneId → latest snapshot
  const [devices,    setDevices]    = useState([])
  const [connected,  setConnected]  = useState(false)
  const [lastSync,   setLastSync]   = useState(null)  // timestamp of last received msg
  const wsRef    = useRef(null)
  const retries  = useRef(0)
  const timerRef = useRef(null)

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retries.current = 0
      console.log('[edge-ws] Connected')
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'snapshot') {
          setSnapshots(prev => ({ ...prev, [msg.id]: msg }))
          setLastSync(new Date())
        }
        if (msg.type === 'device_status') {
          setDevices(prev => {
            const next = prev.filter(d => d.deviceId !== msg.deviceId)
            return [...next, msg]
          })
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      setConnected(false)
      const delay = Math.min(1000 * 2 ** retries.current, 30_000)
      retries.current++
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => { clearTimeout(timerRef.current); wsRef.current?.close() }
  }, [connect])

  // Format last sync for display
  const lastSyncLabel = lastSync
    ? `${Math.round((Date.now() - lastSync.getTime()) / 60_000)} min ago`
    : 'Never'

  return { snapshots, devices, connected, lastSync, lastSyncLabel }
}
