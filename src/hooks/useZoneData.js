import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchZoneData, fetchAllZones } from '../services/dataService'

/**
 * Hook to fetch and auto-refresh data for a single zone.
 * @param {string} zoneId - e.g. 'corbett-a'
 * @param {number} refreshInterval - ms between refreshes (default 60s)
 */
export function useZoneData(zoneId, refreshInterval = 60_000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchZoneData(zoneId)
      setData(result)
    } catch (err) {
      console.error('[useZoneData]', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [zoneId])

  useEffect(() => {
    setLoading(true)
    load()
    timerRef.current = setInterval(load, refreshInterval)
    return () => clearInterval(timerRef.current)
  }, [load, refreshInterval])

  return { data, loading, error, refetch: load }
}

/**
 * Hook to fetch and auto-refresh data for ALL zones.
 * @param {number} refreshInterval - ms between refreshes (default 60s)
 */
export function useAllZones(refreshInterval = 60_000) {
  const [zones, setZones] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await fetchAllZones()
      setZones(result)
    } catch (err) {
      console.error('[useAllZones]', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
    timerRef.current = setInterval(load, refreshInterval)
    return () => clearInterval(timerRef.current)
  }, [load, refreshInterval])

  return { zones, loading, error, refetch: load }
}
