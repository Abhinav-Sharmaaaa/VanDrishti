/**
 * VanDrishti — Data Cache Service
 *
 * Single source of truth for all zone data.
 * - Fetches all APIs once, stores result as JSON in localStorage
 * - All hooks read from cache — no API calls on every page load
 * - Settings control fetch interval (or manual-only mode)
 * - RPi mode: cache can be exported as JSON and served over HTTP
 *
 * Flow:
 *   FetchModal → fetchAndCacheAll() → localStorage → hooks read cache
 */

import { fetchAllZones } from './dataService'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
const CACHE_KEY    = 'vandrishti_zone_cache'
const META_KEY     = 'vandrishti_cache_meta'
const SETTINGS_KEY = 'vandrishti_settings'

// ---------------------------------------------------------------------------
// Default settings
// ---------------------------------------------------------------------------
export const DEFAULT_SETTINGS = {
  fetchInterval: 30,      // minutes; 0 = manual only
  autoFetchOnLoad: true,  // auto-fetch if cache is stale on app load
  rpiMode: false,         // when true, show RPi endpoint export options
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch { return { ...DEFAULT_SETTINGS } }
}

export function saveSettings(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch {}
}

// ---------------------------------------------------------------------------
// Cache meta (timestamp, zone count, source summary)
// ---------------------------------------------------------------------------
export function getCacheMeta() {
  try {
    const raw = localStorage.getItem(META_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCacheMeta(meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)) } catch {}
}

// ---------------------------------------------------------------------------
// Cache read / write
// ---------------------------------------------------------------------------
export function getCachedZones() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setCachedZones(zonesMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(zonesMap))
    const meta = {
      fetchedAt:    new Date().toISOString(),
      zoneCount:    Object.keys(zonesMap).length,
      // Summarise which sources are live vs mock
      sources:      summariseSources(zonesMap),
    }
    saveCacheMeta(meta)
    return meta
  } catch { return null }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY)
  localStorage.removeItem(META_KEY)
}

function summariseSources(zonesMap) {
  const summary = {}
  const zones = Object.values(zonesMap)
  if (!zones.length) return summary
  // Use first zone's dataSource as representative
  const ds = zones[0]?.dataSource ?? {}
  for (const [key, val] of Object.entries(ds)) {
    const liveCount = zones.filter(z => z.dataSource?.[key] !== 'mock').length
    summary[key] = liveCount === zones.length ? 'live'
                 : liveCount > 0 ? `${liveCount}/${zones.length} live`
                 : 'mock'
  }
  return summary
}

// ---------------------------------------------------------------------------
// Staleness check
// ---------------------------------------------------------------------------
export function isCacheStale() {
  const meta     = getCacheMeta()
  const settings = getSettings()
  if (!meta) return true
  if (settings.fetchInterval === 0) return false   // manual-only: never auto-stale
  const ageMinutes = (Date.now() - new Date(meta.fetchedAt).getTime()) / 60_000
  return ageMinutes > settings.fetchInterval
}

export function cacheAgeMinutes() {
  const meta = getCacheMeta()
  if (!meta) return null
  return Math.round((Date.now() - new Date(meta.fetchedAt).getTime()) / 60_000)
}

// ---------------------------------------------------------------------------
// Main fetch — called by FetchModal
//
// onProgress({ stage, zoneId, zoneName, api, status, error })
//   stage: 'start' | 'zone' | 'api' | 'done' | 'error'
//   status: 'fetching' | 'success' | 'mock' | 'error'
// ---------------------------------------------------------------------------
export async function fetchAndCacheAll(onProgress = () => {}) {
  onProgress({ stage: 'start', total: 0 })

  let result
  try {
    // fetchAllZones already calls all APIs in parallel per zone
    // We wrap it to emit progress events
    result = await fetchAllZonesWithProgress(onProgress)
  } catch (err) {
    onProgress({ stage: 'error', error: err.message })
    throw err
  }

  const meta = setCachedZones(result)
  onProgress({ stage: 'done', meta, result })
  return { result, meta }
}

// ---------------------------------------------------------------------------
// fetchAllZones with per-zone progress events
// We re-implement the parallel fetch here so we can emit events
// ---------------------------------------------------------------------------
async function fetchAllZonesWithProgress(onProgress) {
  const { ZONES, fetchZoneData } = await import('./dataService')

  const zoneIds = Object.keys(ZONES)
  onProgress({ stage: 'start', total: zoneIds.length })

  const results = await Promise.allSettled(
    zoneIds.map(async (id) => {
      const meta = ZONES[id]
      onProgress({ stage: 'zone', zoneId: id, zoneName: meta.name, status: 'fetching' })
      try {
        const data = await fetchZoneData(id)
        onProgress({ stage: 'zone', zoneId: id, zoneName: meta.name, status: 'success', fhi: data.fhi, dataSource: data.dataSource })
        return [id, data]
      } catch (err) {
        onProgress({ stage: 'zone', zoneId: id, zoneName: meta.name, status: 'error', error: err.message })
        throw err
      }
    })
  )

  return Object.fromEntries(
    results.filter(r => r.status === 'fulfilled').map(r => r.value)
  )
}

// ---------------------------------------------------------------------------
// JSON export (for RPi serving)
// ---------------------------------------------------------------------------
export function exportCacheAsJson() {
  const zones = getCachedZones()
  const meta  = getCacheMeta()
  const settings = getSettings()
  return JSON.stringify({ meta, settings, zones }, null, 2)
}

export function downloadCacheJson() {
  const json = exportCacheAsJson()
  const blob = new Blob([json], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `vandrishti-data-${new Date().toISOString().slice(0,16).replace('T','-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}
