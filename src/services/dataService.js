import { fetchNDVI } from './ndvi'
import { fetchFireEvents } from './firms'
import { fetchSpeciesCount } from './gbif'
import { fetchBirdActivity } from './ebird'
import { fetchWeather } from './weather'
import { fetchTreeCoverLoss } from './gfw'
import { reverseGeocode } from './geocode'

const BUILTIN_ZONES = {
  'corbett-a': {
    name: 'Corbett-A', lat: 29.53, lon: 78.77,
    bbox: { minLon: 78.6, minLat: 29.4, maxLon: 78.9, maxLat: 29.7 },
    isoCode: 'IND', adminCode: '36', coords: '29.53°N, 78.77°E', custom: false,
  },
  'corbett-b': {
    name: 'Corbett-B', lat: 29.58, lon: 78.82,
    bbox: { minLon: 78.7, minLat: 29.45, maxLon: 79.0, maxLat: 29.72 },
    isoCode: 'IND', adminCode: '36', coords: '29.58°N, 78.82°E', custom: false,
  },
  'sundarbans-a': {
    name: 'Sundarbans-A', lat: 21.94, lon: 88.89,
    bbox: { minLon: 88.7, minLat: 21.7, maxLon: 89.1, maxLat: 22.1 },
    isoCode: 'IND', adminCode: '28', coords: '21.94°N, 88.89°E', custom: false,
  },
  'sundarbans-b': {
    name: 'Sundarbans-B', lat: 21.88, lon: 89.02,
    bbox: { minLon: 88.85, minLat: 21.7, maxLon: 89.2, maxLat: 22.0 },
    isoCode: 'IND', adminCode: '28', coords: '21.88°N, 89.02°E', custom: false,
  },
}

const STORAGE_KEY  = 'vandrishti_custom_zones'
const DELETED_KEY  = 'vandrishti_deleted_zones'  

function loadCustomZones() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}

function saveCustomZones(zones) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(zones)) } catch {}
}

function loadDeletedZoneIds() {
  try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || '[]')) } catch { return new Set() }
}

function saveDeletedZoneIds(set) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify([...set])) } catch {}
}

/** Mutable registry — built-in (minus deleted) + custom zones loaded at startup */
const _deleted = loadDeletedZoneIds()
const _filteredBuiltins = Object.fromEntries(
  Object.entries(BUILTIN_ZONES).filter(([id]) => !_deleted.has(id))
)
export const ZONES = { ..._filteredBuiltins, ...loadCustomZones() }

/**
 * Add a custom zone drawn on the map. Persists to localStorage.
 * @param {{ id, name, lat, lon, bbox, coords, isoCode, adminCode }} meta
 */
export function addCustomZone(meta) {
  const entry = { ...meta, custom: true }
  ZONES[meta.id] = entry
  const custom = loadCustomZones()
  custom[meta.id] = entry
  saveCustomZones(custom)
}

/**
 * Delete any zone (built-in or custom). Persists the deletion so it
 * survives a page refresh.
 */
export function removeCustomZone(id) {
  delete ZONES[id]
  
  const custom = loadCustomZones()
  delete custom[id]
  saveCustomZones(custom)
  
  if (id in BUILTIN_ZONES) {
    const deleted = loadDeletedZoneIds()
    deleted.add(id)
    saveDeletedZoneIds(deleted)
  }
  
  try {
    const raw = localStorage.getItem('vandrishti_zone_cache')
    if (raw) {
      const cache = JSON.parse(raw)
      delete cache[id]
      localStorage.setItem('vandrishti_zone_cache', JSON.stringify(cache))
    }
  } catch {}
}





function mockForecast(baseTemp, baseHumidity, conditions) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1)
    const v = (i % 3 - 1) * 2   
    return {
      date:     d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tempMax:  baseTemp + Math.abs(v) + 2,
      tempMin:  baseTemp - Math.abs(v) - 1,
      humidity: Math.min(100, Math.max(20, baseHumidity + (i % 2 === 0 ? 5 : -5))),
      rain:     i === 2 ? 2.5 : 0,
      condition: conditions[i % conditions.length],
    }
  })
}

const MOCK_DATA = {
  'corbett-a': {
    ndvi: 68, fireCount: 7, speciesCount: 89, birdScore: 54, birdSpecies: 62,
    weather: {
      temp: 31, humidity: 58, rainfall: 0, windSpeed: 3.2,
      condition: 'Haze', description: 'haze', feelsLike: 33,
      pressure: 1008, visibility: 4, cloudCover: 55,
      sunrise: '06:12 AM', sunset: '06:48 PM',
      moistureScore: 42,
      forecast: mockForecast(31, 58, ['Haze', 'Clear', 'Partly Cloudy', 'Clear', 'Haze']),
    },
    treeCoverLoss: { totalLossHa: 3200, coverLossPct: 36, yearlyLoss: [] },
    placeName: 'Jim Corbett National Park, Uttarakhand', carbonStock: 2847,
  },
  'corbett-b': {
    ndvi: 82, fireCount: 1, speciesCount: 134, birdScore: 72, birdSpecies: 98,
    weather: {
      temp: 28, humidity: 77, rainfall: 2.4, windSpeed: 2.1,
      condition: 'Clouds', description: 'partly cloudy', feelsLike: 30,
      pressure: 1012, visibility: 9, cloudCover: 40,
      sunrise: '06:10 AM', sunset: '06:50 PM',
      moistureScore: 75,
      forecast: mockForecast(28, 77, ['Clouds', 'Rain', 'Clouds', 'Clear', 'Clouds']),
    },
    treeCoverLoss: { totalLossHa: 580, coverLossPct: 88, yearlyLoss: [] },
    placeName: 'Jim Corbett Buffer Zone, Uttarakhand', carbonStock: 4102,
  },
  'sundarbans-a': {
    ndvi: 74, fireCount: 4, speciesCount: 112, birdScore: 63, birdSpecies: 85,
    weather: {
      temp: 32, humidity: 82, rainfall: 1.1, windSpeed: 4.7,
      condition: 'Rain', description: 'light rain', feelsLike: 36,
      pressure: 1005, visibility: 7, cloudCover: 75,
      sunrise: '05:30 AM', sunset: '05:55 PM',
      moistureScore: 62,
      forecast: mockForecast(32, 82, ['Rain', 'Clouds', 'Rain', 'Thunderstorm', 'Clouds']),
    },
    treeCoverLoss: { totalLossHa: 1800, coverLossPct: 64, yearlyLoss: [] },
    placeName: 'Sundarbans Tiger Reserve, West Bengal', carbonStock: 3891,
  },
  'sundarbans-b': {
    ndvi: 35, fireCount: 12, speciesCount: 41, birdScore: 29, birdSpecies: 34,
    weather: {
      temp: 35, humidity: 68, rainfall: 0, windSpeed: 5.8,
      condition: 'Clear', description: 'clear sky, hot & dry', feelsLike: 38,
      pressure: 1002, visibility: 12, cloudCover: 10,
      sunrise: '05:28 AM', sunset: '05:52 PM',
      moistureScore: 25,
      forecast: mockForecast(35, 68, ['Clear', 'Haze', 'Clear', 'Clear', 'Clouds']),
    },
    treeCoverLoss: { totalLossHa: 6200, coverLossPct: 8, yearlyLoss: [] },
    placeName: 'Sundarbans South, West Bengal', carbonStock: 589,
  },
}

/** Neutral fallback mock for custom zones with no hardcoded data */
function customMock(meta) {
  return {
    ndvi: 60, fireCount: 2, speciesCount: 80, birdScore: 50, birdSpecies: 55,
    weather: {
      temp: 28, humidity: 65, rainfall: 0.5, windSpeed: 3.0,
      condition: 'Clear', description: 'clear sky', feelsLike: 29,
      pressure: 1010, visibility: 10, cloudCover: 20,
      sunrise: '06:00 AM', sunset: '06:30 PM',
      moistureScore: 55,
      forecast: mockForecast(28, 65, ['Clear', 'Clouds', 'Clear', 'Rain', 'Clear']),
    },
    treeCoverLoss: { totalLossHa: 1000, coverLossPct: 70, yearlyLoss: [] },
    placeName: meta.name, carbonStock: 2000,
  }
}


function computeFHI({ ndvi, fireCount, speciesScore, birdScore, moistureScore, coverLossPct }) {
  return Math.max(0, Math.min(100, Math.round(
    Math.min(100, ndvi)                    * 0.30 +
    Math.max(0, 100 - fireCount * 5)       * 0.20 +
    Math.min(100, speciesScore)            * 0.15 +
    Math.min(100, birdScore)               * 0.10 +
    Math.min(100, moistureScore)           * 0.15 +
    Math.min(100, coverLossPct)            * 0.10
  )))
}

function getStatus(fhi) {
  if (fhi >= 60) return 'healthy'
  if (fhi >= 40) return 'watch'
  if (fhi >= 20) return 'alert'
  return 'critical'
}




export async function fetchZoneData(zoneId) {
  const meta = ZONES[zoneId]
  if (!meta) throw new Error(`Unknown zone: ${zoneId}`)

  const today = new Date()
  const fromDate = new Date(today)
  fromDate.setDate(today.getDate() - 14)
  const fmt = d => d.toISOString().slice(0, 10)

  const [ndviR, fireR, gbifR, ebirdR, weatherR, gfwR, placeR] =
    await Promise.allSettled([
      fetchNDVI(meta.bbox, fmt(fromDate), fmt(today)),
      fetchFireEvents(meta.bbox, 7),
      fetchSpeciesCount(meta.bbox),
      fetchBirdActivity(meta.lat, meta.lon),
      fetchWeather(meta.lat, meta.lon),
      fetchTreeCoverLoss(meta.bbox, fmt(fromDate), fmt(today)),
      reverseGeocode(meta.lat, meta.lon),
    ])

  const mock        = MOCK_DATA[zoneId] ?? customMock(meta)
  const ndvi        = ndviR.value          ?? mock.ndvi
  const fireCount   = fireR.value?.count   ?? mock.fireCount
  const speciesCnt  = gbifR.value?.speciesCount ?? mock.speciesCount
  const birdScore   = ebirdR.value?.score  ?? mock.birdScore
  const birdSpecies = ebirdR.value?.speciesCount ?? mock.birdSpecies
  const weather     = weatherR.value       ?? mock.weather
  const gfw         = gfwR.value           ?? mock.treeCoverLoss
  const placeName   = placeR.value?.display_name?.split(',').slice(0, 2).join(',') ?? mock.placeName

  const speciesScore = Math.min(100, Math.round((speciesCnt / 150) * 60 + birdScore * 0.4))
  const fhi          = computeFHI({ ndvi, fireCount, speciesScore, birdScore, moistureScore: weather.moistureScore, coverLossPct: gfw.coverLossPct })
  const status       = getStatus(fhi)

  return {
    id: zoneId, name: meta.name, coords: meta.coords, placeName,
    custom: meta.custom ?? false,
    fhi, status,
    bbox: meta.bbox,
    signals: {
      ndvi, biodiversity: speciesScore,
      thermalRisk: Math.min(100, fireCount * 5),
      moisture: weather.moistureScore,
      coverHealth: gfw.coverLossPct,
    },
    weather,
    fire: { count: fireCount },
    species: { count: speciesCnt, birdSpecies },
    treeCover: gfw,
    carbonStock: mock.carbonStock,
    lastUpdated: new Date().toISOString(),
    dataSource: {
      ndvi:      ndviR.value    != null ? 'Copernicus'     : 'mock',
      fire:      fireR.value    != null ? 'NASA FIRMS'     : 'mock',
      species:   gbifR.value    != null ? 'GBIF'           : 'mock',
      birds:     ebirdR.value   != null ? 'eBird'          : 'mock',
      weather:   weatherR.value != null ? 'OpenWeatherMap' : 'mock',
      treeCover: gfwR.value     != null ? 'Copernicus Land': 'mock',
    },
  }
}




export async function fetchAllZones() {
  const results = await Promise.allSettled(
    Object.keys(ZONES).map(id => fetchZoneData(id).then(data => [id, data]))
  )
  return Object.fromEntries(
    results.filter(r => r.status === 'fulfilled').map(r => r.value)
  )
}