/**
 * useAlertMonitor — background hook that watches all zone data and fires
 * phone / Telegram notifications when alert conditions are detected.
 *
 * Usage — add once at the app root (App.jsx or equivalent):
 *
 *   import { useAlertMonitor } from './hooks/useAlertMonitor'
 *   function App() {
 *     useAlertMonitor()
 *     // ... rest of app
 *   }
 *
 * The hook polls zone data every 5 minutes (configurable), runs the same
 * classifier used by Alerts.jsx, and sends dispatch notifications for each
 * new alert. It never re-fires the same alert within the cooldown window.
 */

import { useEffect, useRef } from 'react'
import { useAllZones } from './useZoneData'
import { sendDispatchNotification, getNotifSettings } from '../services/notificationService'

// ---------------------------------------------------------------------------
// Alert classifier — mirrors Alerts.jsx classifyProblems / buildAlerts
// (kept local so the hook is self-contained and Alerts.jsx needs no changes)
// ---------------------------------------------------------------------------

const GOVT_CONTACTS = {
  dfo:        { id: 'dfo',        name: 'District Forest Officer',         dept: 'State Forest Dept.',           contact: '+91-1378-222001' },
  rfo:        { id: 'rfo',        name: 'Range Forest Officer',            dept: 'Forest Range Division',        contact: '+91-1378-222045' },
  fire_dept:  { id: 'fire_dept',  name: 'State Fire & Emergency Services', dept: 'Uttarakhand Fire Dept.',       contact: '+91-1378-101'    },
  ranger:     { id: 'ranger',     name: 'Forest Ranger Team',              dept: 'Field Operations Unit',        contact: '+91-98765-43210' },
  wildlife:   { id: 'wildlife',   name: 'Wildlife Warden',                 dept: 'Wildlife Crime Control',       contact: '+91-1378-222089' },
  sdrf:       { id: 'sdrf',       name: 'State Disaster Response Force',   dept: 'SDRF Uttarakhand',             contact: '+91-1378-1077'   },
  irrigation: { id: 'irrigation', name: 'State Irrigation Dept.',          dept: 'Water Resource Division',      contact: '+91-1378-222110' },
}

function classifyProblems(zone) {
  const p = []

  if (zone.fire.count > 5 || zone.fhi < 25)
    p.push({
      type: 'fire_outbreak', label: 'Fire Outbreak', severity: 'critical',
      teams: [GOVT_CONTACTS.fire_dept, GOVT_CONTACTS.ranger, GOVT_CONTACTS.sdrf],
      description: `${zone.fire.count} thermal anomalies. FHI: ${zone.fhi}. Immediate ground verification required.`,
    })

  if (zone.signals.thermalRisk >= 30 && zone.fire.count <= 5 && zone.fhi >= 25)
    p.push({
      type: 'thermal_anomaly', label: 'Thermal Anomaly', severity: 'alert',
      teams: [GOVT_CONTACTS.ranger, GOVT_CONTACTS.rfo],
      description: `Thermal risk ${zone.signals.thermalRisk}%. ${zone.fire.count} anomalies detected.`,
    })

  if (zone.signals.biodiversity < 50)
    p.push({
      type: 'biodiversity_loss', label: 'Biodiversity Loss', severity: 'watch',
      teams: [GOVT_CONTACTS.wildlife, GOVT_CONTACTS.rfo],
      description: `Biodiversity index ${zone.signals.biodiversity}%. ${zone.species.birdSpecies} bird species observed.`,
    })

  if (zone.signals.moisture < 40)
    p.push({
      type: 'moisture_stress', label: 'Moisture Stress', severity: 'watch',
      teams: [GOVT_CONTACTS.irrigation, GOVT_CONTACTS.rfo],
      description: `Moisture index ${zone.signals.moisture}%. Prolonged deficit risk.`,
    })

  if (zone.signals.ndvi < 40 || zone.signals.coverHealth < 40)
    p.push({
      type: 'canopy_decline', label: 'Canopy Decline',
      severity: zone.signals.ndvi < 25 ? 'critical' : 'watch',
      teams: [GOVT_CONTACTS.dfo, GOVT_CONTACTS.rfo],
      description: `NDVI ${zone.signals.ndvi}%. Cover health ${zone.signals.coverHealth}%.`,
    })

  // Escalate all teams to SDRF if 3+ problems
  if (p.length >= 3) {
    p.forEach(x => {
      if (!x.teams.find(t => t.id === 'sdrf')) x.teams.push(GOVT_CONTACTS.sdrf)
    })
  }

  return p
}

function buildAlerts(zones) {
  const alerts = []
  for (const z of zones) {
    const problems = classifyProblems(z)
    if (!problems.length) continue

    const allTeams = []
    const seen     = new Set()
    for (const p of problems) {
      for (const t of p.teams) {
        if (!seen.has(t.id)) { allTeams.push(t); seen.add(t.id) }
      }
    }

    alerts.push({
      zoneId:       z.id,
      zone:         z.name,
      fhi:          z.fhi,
      severity:     problems.some(p => p.severity === 'critical') ? 'critical'
                  : problems.some(p => p.severity === 'alert')    ? 'alert'
                  : 'watch',
      problemTypes: problems.map(p => p.type),
      problems,
      teams:        allTeams,
      resolved:     false,
    })
  }
  return alerts
}

// ---------------------------------------------------------------------------
// FIX: processAlerts was imported from notificationService but never existed
// there. Implemented locally — sends a dispatch notification for the first
// (highest-priority) team on each unresolved alert.
// ---------------------------------------------------------------------------
async function processAlerts(alerts) {
  for (const alert of alerts) {
    if (alert.resolved || !alert.teams.length) continue
    // Notify for the lead team only to avoid spamming all contacts
    const leadTeam = alert.teams[0]
    try {
      await sendDispatchNotification(leadTeam, alert)
    } catch (err) {
      console.error('[AlertMonitor] sendDispatchNotification error:', err)
    }
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Poll interval for zone data when notifications are enabled (ms) */
const MONITOR_POLL_MS = 5 * 60 * 1000   // 5 minutes

export function useAlertMonitor() {
  const settings         = getNotifSettings()
  // Only poll at monitor rate when notifications are enabled; otherwise fall
  // back to whatever useAllZones normally does (it won't re-fetch more often).
  const pollMs           = settings.enabled ? MONITOR_POLL_MS : 0
  const { zones: map }   = useAllZones(pollMs)
  const lastProcessedRef = useRef(null)

  useEffect(() => {
    // Re-read settings live (getNotifSettings reads localStorage directly)
    const cfg = getNotifSettings()
    if (!cfg.enabled) return

    const zones = Object.values(map)
    if (!zones.length) return

    // Produce a simple fingerprint so we don't re-process the same data
    const fingerprint = zones.map(z => `${z.id}:${z.fhi}:${z.fire.count}`).join('|')
    if (fingerprint === lastProcessedRef.current) return
    lastProcessedRef.current = fingerprint

    const alerts = buildAlerts(zones)
    if (alerts.length) {
      processAlerts(alerts).catch(err =>
        console.error('[AlertMonitor] processAlerts error:', err)
      )
    }
  }, [map])
}