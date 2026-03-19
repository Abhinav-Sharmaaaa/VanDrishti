

import { useState, useEffect, useCallback } from 'react'
import { getCachedZones, getCacheMeta, isCacheStale, cacheAgeMinutes } from '../services/dataCache'





const CACHE_EVENT = 'vandrishti:cache-updated'

export function notifyCacheUpdated() {
  window.dispatchEvent(new CustomEvent(CACHE_EVENT))
}




export function useAllZones() {
  const [zones, setZones]   = useState(() => getCachedZones() ?? {})
  const [loading, setLoading] = useState(() => !getCachedZones())

  const refresh = useCallback(() => {
    const cached = getCachedZones()
    if (cached) { setZones(cached); setLoading(false) }
  }, [])

  useEffect(() => {
    
    refresh()

    
    window.addEventListener(CACHE_EVENT, refresh)
    return () => window.removeEventListener(CACHE_EVENT, refresh)
  }, [refresh])

  return { zones, loading, refresh }
}




export function useZoneData(zoneId) {
  const { zones, loading } = useAllZones()
  const data = zones[zoneId] ?? null
  return { data, loading: loading || (!data && !Object.keys(zones).length) }
}




export function useCacheStatus() {
  const [meta, setMeta]   = useState(getCacheMeta)
  const [stale, setStale] = useState(isCacheStale)
  const [ageMin, setAgeMin] = useState(cacheAgeMinutes)

  const refresh = useCallback(() => {
    setMeta(getCacheMeta())
    setStale(isCacheStale())
    setAgeMin(cacheAgeMinutes())
  }, [])

  useEffect(() => {
    refresh()
    window.addEventListener(CACHE_EVENT, refresh)
    
    const t = setInterval(refresh, 60_000)
    return () => { window.removeEventListener(CACHE_EVENT, refresh); clearInterval(t) }
  }, [refresh])

  return { meta, stale, ageMin, refresh }
}
