/**
 * VanDrishti — Dispatch Notification Service
 *
 * Sends a phone notification ONLY when a team is dispatched from the
 * Alert Center. Notifications include the zone, problems detected,
 * and the specific team that was dispatched with their contact number.
 *
 * Channels:
 *   1. Telegram Bot  — direct message to the user's phone via Bot API
 *                      (no backend required; browser calls api.telegram.org)
 *   2. Browser Push  — Web Notifications API (works as a PWA on mobile)
 *
 * Entry point:
 *   sendDispatchNotification(team, alert) → called by Alerts.jsx on dispatch
 */

const SETTINGS_KEY = 'vandrishti_notif_settings'

export const DEFAULT_NOTIF_SETTINGS = {
  enabled: false,
  telegram: { enabled: false, botToken: '', chatId: '' },
  browser:  { enabled: false },
}

export function getNotifSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_NOTIF_SETTINGS }
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_NOTIF_SETTINGS, ...parsed,
      telegram: { ...DEFAULT_NOTIF_SETTINGS.telegram, ...(parsed.telegram ?? {}) },
      browser:  { ...DEFAULT_NOTIF_SETTINGS.browser,  ...(parsed.browser  ?? {}) },
    }
  } catch { return { ...DEFAULT_NOTIF_SETTINGS } }
}

export function saveNotifSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

export function getBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestBrowserPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return await Notification.requestPermission()
}

function fireBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    const n = new Notification(title, {
      body, icon: '/favicon.ico', badge: '/favicon.ico', requireInteraction: true,
    })
    n.onclick = () => { window.focus(); n.close() }
  } catch (err) { console.error('[Notif] Browser notification error:', err) }
}

const TG_BASE = 'https://api.telegram.org'

export async function sendTelegramMessage(botToken, chatId, html) {
  if (!botToken || !chatId) return { ok: false, error: 'Missing bot token or chat ID.' }
  try {
    const res = await fetch(`${TG_BASE}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
    })
    const data = await res.json()
    if (!data.ok) return { ok: false, error: data.description ?? 'Unknown Telegram error.' }
    return { ok: true }
  } catch (err) { return { ok: false, error: err.message } }
}

export async function verifyBotToken(botToken) {
  if (!botToken) return { ok: false, error: 'No token provided.' }
  try {
    const res  = await fetch(`${TG_BASE}/bot${botToken}/getMe`)
    const data = await res.json()
    if (!data.ok) return { ok: false, error: data.description ?? 'Invalid token.' }
    return { ok: true, botName: data.result.first_name, username: data.result.username }
  } catch (err) { return { ok: false, error: err.message } }
}

export async function detectTelegramChatId(botToken) {
  if (!botToken) return { ok: false, error: 'Paste your bot token first.' }
  try {
    const res  = await fetch(`${TG_BASE}/bot${botToken}/getUpdates?limit=20&timeout=0`)
    const data = await res.json()
    if (!data.ok) {
      if (res.status === 401) return { ok: false, error: 'Invalid bot token — check it and try again.' }
      return { ok: false, error: data.description ?? 'Telegram error.' }
    }
    const updates = data.result ?? []
    if (!updates.length) return { ok: false, error: 'No messages received yet. Open Telegram, find your bot, and send it any message (e.g. "hi"), then click Detect again.' }
    const latest = updates[updates.length - 1]
    const chat   = latest?.message?.chat ?? latest?.channel_post?.chat
    if (!chat?.id) return { ok: false, error: 'Could not read chat ID from Telegram response.' }
    return { ok: true, chatId: String(chat.id), name: chat?.first_name ?? chat?.username ?? chat?.title ?? '' }
  } catch (err) { return { ok: false, error: err.message } }
}

function sevEmoji(severity) {
  if (severity === 'critical') return '🚨'
  if (severity === 'alert')    return '⚠️'
  return '👁'
}

function formatDispatchMessage(alert, team) {
  const time = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }) + ' IST'

  const lines = [
    `${sevEmoji(alert.severity)} <b>Team Dispatched — VanDrishti</b>`,
    '',
    `<b>Zone:</b> ${alert.zone}`,
    `<b>FHI:</b> ${alert.fhi} / 100  ·  <b>Status:</b> ${alert.severity.toUpperCase()}`,
    `<b>Time:</b> ${time}`,
    '',
    `<b>Team dispatched:</b>`,
    `  👥 <b>${team.name}</b>`,
    `  🏢 ${team.dept}`,
    `  📞 <code>${team.contact}</code>`,
  ]

  if (alert.problems?.length) {
    lines.push('', `<b>Problems requiring attention (${alert.problems.length}):</b>`)
    alert.problems.forEach(p => lines.push(`  • <b>${p.label}</b> — ${p.description}`))
  }

  lines.push('', '<i>VanDrishti Forest Intelligence Monitor</i>')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// sendDispatchNotification — called when the user clicks a Dispatch button.
// Sends a Telegram message (and browser notification) for that specific team.
//
// @param {object} team  — { id, name, dept, contact }
// @param {object} alert — { zone, fhi, severity, problems[], teams[] }
// ---------------------------------------------------------------------------
export async function sendDispatchNotification(team, alert) {
  const settings = getNotifSettings()

  const time = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }) + ' IST'

  // ── Browser notification ───────────────────────────────────────
  if (settings.browser?.enabled) {
    fireBrowserNotification(
      `📡 Dispatched — ${team.name}`,
      `${alert.zone} · FHI ${alert.fhi} · ${alert.problems.map(p => p.label).join(', ')}`,
    )
  }

  // ── Telegram message ───────────────────────────────────────────
  if (
    settings.telegram?.enabled &&
    settings.telegram.botToken &&
    settings.telegram.chatId
  ) {
    const sev = alert.severity === 'critical' ? '🚨' : alert.severity === 'alert' ? '⚠️' : '👁'

    const lines = [
      `📡 <b>Team Dispatched — VanDrishti</b>`,
      '',
      `<b>Team:</b> ${team.name}`,
      `<b>Dept:</b> ${team.dept}`,
      team.contact ? `<b>Contact:</b> <code>${team.contact}</code>` : null,
      '',
      `<b>Zone:</b> ${alert.zone}`,
      `<b>Severity:</b> ${sev} ${alert.severity.toUpperCase()}`,
      `<b>FHI:</b> ${alert.fhi} / 100`,
      `<b>Time:</b> ${time}`,
    ]

    if (alert.problems?.length) {
      lines.push('', `<b>Problems (${alert.problems.length}):</b>`)
      alert.problems.forEach(p =>
        lines.push(`  • <b>${p.label}</b> — ${p.description}`)
      )
    }

    const otherTeams = (alert.teams ?? []).filter(t => t.id !== team.id)
    if (otherTeams.length) {
      lines.push('', '<b>Other assigned teams:</b>')
      otherTeams.forEach(t =>
        lines.push(`  • ${t.name}${t.contact ? ` — <code>${t.contact}</code>` : ''}`)
      )
    }

    lines.push('', '<i>VanDrishti Forest Intelligence Monitor</i>')

    const result = await sendTelegramMessage(
      settings.telegram.botToken,
      settings.telegram.chatId,
      lines.filter(l => l !== null).join('\n'),
    )
    if (!result.ok) console.error('[Notif] Dispatch Telegram send failed:', result.error)
    return result
  }

  return { ok: true }
}

export async function sendTestAlert() {
  const settings = getNotifSettings()
  const results  = {}

  if (settings.browser?.enabled) {
    fireBrowserNotification(
      'VanDrishti ✅ Test',
      'Notifications are working. You will be alerted when a team is dispatched.',
    )
    results.browser = { ok: true }
  }

  if (settings.telegram?.enabled && settings.telegram.botToken && settings.telegram.chatId) {
    results.telegram = await sendTelegramMessage(
      settings.telegram.botToken,
      settings.telegram.chatId,
      [
        '✅ <b>VanDrishti — Test Notification</b>',
        '',
        'Telegram is configured correctly.',
        'You will receive a message here each time a response team is dispatched from the Alert Center.',
        '',
        '<i>VanDrishti Forest Intelligence Monitor</i>',
      ].join('\n'),
    )
  }

  return results
}