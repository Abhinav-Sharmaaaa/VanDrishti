/**
 * useZoneData hooks — VanDrishti
 *
 * All hooks read from the localStorage cache written by dataCache.js / FetchModal.
 * They do NOT call external APIs directly — that is the FetchModal's job.
 *
 * useZoneData(zoneId)   → { data, loading }      single zone
 * useAllZones()         → { zones, loading }      all zones as map
 * useCacheStatus()      → { meta, stale, ageMin } cache health info
 */

import { useState, useEffect, useCallback } from 'react'
import { getCachedZones, getCacheMeta, isCacheStale, cacheAgeMinutes } from '../services/dataCache'

// ---------------------------------------------------------------------------
// Internal: subscribe to cache updates via a custom event
// FetchModal dispatches 'vandrishti:cache-updated' after each successful fetch
// ---------------------------------------------------------------------------
const CACHE_EVENT = 'vandrishti:cache-updated'

export function notifyCacheUpdated() {
  window.dispatchEvent(new CustomEvent(CACHE_EVENT))
}

// ---------------------------------------------------------------------------
// useAllZones — returns all zones from cache
// ---------------------------------------------------------------------------
export function useAllZones() {
  const [zones, setZones]   = useState(() => getCachedZones() ?? {})
  const [loading, setLoading] = useState(() => !getCachedZones())

  const refresh = useCallback(() => {
    const cached = getCachedZones()
    if (cached) { setZones(cached); setLoading(false) }
  }, [])

  useEffect(() => {
    // Initial read
    refresh()

    // Listen for cache updates from FetchModal
    window.addEventListener(CACHE_EVENT, refresh)
    return () => window.removeEventListener(CACHE_EVENT, refresh)
  }, [refresh])

  return { zones, loading, refresh }
}

// ---------------------------------------------------------------------------
// useZoneData — returns a single zone from cache
// ---------------------------------------------------------------------------
export function useZoneData(zoneId) {
  const { zones, loading } = useAllZones()
  const data = zones[zoneId] ?? null
  return { data, loading: loading || (!data && !Object.keys(zones).length) }
}

// ---------------------------------------------------------------------------
// useCacheStatus — metadata about the cache (used by Dashboard & Settings)
// ---------------------------------------------------------------------------
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
    // Also tick every minute to update age display
    const t = setInterval(refresh, 60_000)
    return () => { window.removeEventListener(CACHE_EVENT, refresh); clearInterval(t) }
  }, [refresh])

  return { meta, stale, ageMin, refresh }
}
