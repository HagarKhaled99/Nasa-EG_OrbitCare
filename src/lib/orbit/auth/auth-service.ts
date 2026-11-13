/**
 * ORBIT TWIN auth: browser side. Owner: Member 1.
 *
 * The SERVER checks every PIN (sample crew included), applies the lockout and issues the session as a signed
 * httpOnly cookie (server/session.mjs, design by Member 2). The browser never sees a PIN hash or the session
 * token. This file only holds shared constants, result types and the "recent sign-ins" list used to sort the
 * crew on the sign-in screen (a convenience, not a security feature).
 */

/** PIN for the four built-in sample crew members (shown on the sign-in screen as demo data). */
export const DEMO_PIN = '2026'
export const PIN_LENGTH = 4
export const MAX_ATTEMPTS = 5
/** Short lockout so a live demo can recover; a flight system would require a CMO reset instead. */
export const LOCKOUT_MS = 60_000

const RECENT_KEY = 'orbit-twin-recent-sign-ins'

export interface Session {
  astronautId: string
  expiresAt: number
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'invalid-format' }
  | { ok: false; reason: 'server-unavailable'; message: string }

export function isValidPinFormat(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

// ---------- recent sign-ins (UI ordering only) ----------

function readRecent(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

export function recordSignIn(astronautId: string, now = Date.now()) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify({ ...readRecent(), [astronautId]: now }))
  } catch {
    /* storage unavailable: the Recent list just stays empty */
  }
}

export function forgetSignIn(astronautId: string) {
  const next = readRecent()
  delete next[astronautId]
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/** People who signed in on this tablet, most recent first. */
export function recentSignIns(): Array<{ astronautId: string; at: number }> {
  return Object.entries(readRecent())
    .filter(([, at]) => typeof at === 'number')
    .map(([astronautId, at]) => ({ astronautId, at }))
    .sort((a, b) => b.at - a.at)
}

export function formatAgo(at: number, now = Date.now()) {
  const min = Math.round((now - at) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
