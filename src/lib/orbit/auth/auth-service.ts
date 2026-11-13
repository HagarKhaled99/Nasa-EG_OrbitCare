/**
 * ORBIT TWIN local auth service ("the back end" for sign-in / sign-up).
 *
 * Design constraints from the project plan:
 *  - The tablet must work fully offline, so there is NO auth server. Everything lives in localStorage.
 *  - This is crew identification on a shared tablet, not internet-grade security. A 4-digit PIN has only
 *    10 000 combinations; hashing stops casual reading of PINs from storage and the attempt lockout slows
 *    guessing, but anyone with dev-tools access to the tablet could still brute-force it.
 *
 * Every function here is synchronous and storage-backed so it can later be swapped for a real API
 * (same names, returning Promises) without changing the UI contract.
 */
import { sha256Hex } from './sha256'

/** PIN for the four built-in sample crew members (shown on the sign-in screen as demo data). */
export const DEMO_PIN = '2026'
export const PIN_LENGTH = 4
export const MAX_ATTEMPTS = 5
/** Short lockout so a live demo can recover; a flight system would require a CMO reset instead. */
export const LOCKOUT_MS = 60_000
/** One crew shift. After this the tablet asks for the PIN again. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
const HASH_ROUNDS = 2048

const SESSION_KEY = 'orbit-twin-session'
const ATTEMPTS_KEY = 'orbit-twin-pin-attempts'
const LAST_USER_KEY = 'orbit-twin-last-user'
const RECENT_KEY = 'orbit-twin-recent-sign-ins'

export interface PinCredential {
  pinHash: string
  pinSalt: string
}

export interface Session {
  astronautId: string
  signedInAt: number
  expiresAt: number
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'invalid-format' }
  | { ok: false; reason: 'server-unavailable'; message: string }

interface AttemptState {
  failed: number
  lockedUntil: number | null
}

// ---------- storage helpers (never throw: private mode / full storage must not break sign-in) ----------

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: session simply won't survive a refresh */
  }
}

// ---------- PIN credentials ----------

export function isValidPinFormat(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)
}

function hashPin(pin: string, salt: string) {
  let digest = sha256Hex(`${salt}:${pin}`)
  for (let i = 1; i < HASH_ROUNDS; i++) digest = sha256Hex(`${salt}:${digest}`)
  return digest
}

function randomSalt() {
  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createPinCredential(pin: string): PinCredential {
  if (!isValidPinFormat(pin)) throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`)
  const pinSalt = randomSalt()
  return { pinSalt, pinHash: hashPin(pin, pinSalt) }
}

/** Constant-time comparison so timing does not leak how many hex characters matched. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function verifyPin(pin: string, credential: PinCredential) {
  return safeEqual(hashPin(pin, credential.pinSalt), credential.pinHash)
}

let demoCredential: PinCredential | null = null
/** Shared credential for the built-in sample crew (computed once, never stored). */
export function demoCrewCredential(): PinCredential {
  if (!demoCredential) {
    const pinSalt = 'orbit-twin-demo-crew'
    demoCredential = { pinSalt, pinHash: hashPin(DEMO_PIN, pinSalt) }
  }
  return demoCredential
}

// ---------- attempt limiting ----------

function allAttempts() {
  return read<Record<string, AttemptState>>(ATTEMPTS_KEY, {})
}

export function getAttemptState(astronautId: string, now = Date.now()): AttemptState {
  const state = allAttempts()[astronautId] ?? { failed: 0, lockedUntil: null }
  if (state.lockedUntil && state.lockedUntil <= now) return { failed: 0, lockedUntil: null }
  return state
}

function setAttemptState(astronautId: string, state: AttemptState | null) {
  const next = allAttempts()
  if (state) next[astronautId] = state
  else delete next[astronautId]
  write(ATTEMPTS_KEY, next)
}

// ---------- sessions ----------

export function loadSession(now = Date.now()): Session | null {
  const session = read<Session | null>(SESSION_KEY, null)
  if (!session || typeof session.astronautId !== 'string' || session.expiresAt <= now) return null
  return session
}

export function startSession(astronautId: string, now = Date.now()): Session {
  const session: Session = { astronautId, signedInAt: now, expiresAt: now + SESSION_TTL_MS }
  write(SESSION_KEY, session)
  write(LAST_USER_KEY, astronautId)
  write(RECENT_KEY, { ...read<Record<string, number>>(RECENT_KEY, {}), [astronautId]: now })
  return session
}

/** People who signed in on this tablet, most recent first. */
export function recentSignIns(): Array<{ astronautId: string; at: number }> {
  return Object.entries(read<Record<string, number>>(RECENT_KEY, {}))
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

export function endSession() {
  write(SESSION_KEY, null)
}

/** Who used the tablet last — the simulated crew-badge tap pre-selects this person. */
export function lastSignedInId(): string | null {
  return read<string | null>(LAST_USER_KEY, null)
}

// ---------- the sign-in "endpoint" ----------

export function signInWithPin(
  astronautId: string,
  pin: string,
  credential: PinCredential,
  now = Date.now(),
): SignInResult {
  const state = getAttemptState(astronautId, now)
  if (state.lockedUntil) return { ok: false, reason: 'locked', lockedUntil: state.lockedUntil }
  if (!isValidPinFormat(pin)) return { ok: false, reason: 'invalid-format' }

  if (verifyPin(pin, credential)) {
    setAttemptState(astronautId, null)
    return { ok: true, session: startSession(astronautId, now) }
  }

  const failed = state.failed + 1
  if (failed >= MAX_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_MS
    setAttemptState(astronautId, { failed, lockedUntil })
    return { ok: false, reason: 'locked', lockedUntil }
  }
  setAttemptState(astronautId, { failed, lockedUntil: null })
  return { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_ATTEMPTS - failed }
}
