/**
 * Account store (SERVER ONLY: import this only from app/api route handlers).
 *
 * - PINs are never stored. Each account keeps a random salt and a scrypt hash.
 * - 5 wrong PINs lock the account for 5 minutes.
 * - Accounts are saved to <data dir>/accounts.json so sign-ups survive a restart.
 *   The data dir is ORBIT_DATA_DIR, or ~/.orbit-twin by default. It lives
 *   outside the project on purpose: files written inside the project (or a
 *   synced folder like OneDrive) make the Next.js dev server reload forever.
 *   The four demo crew are created on first run (demo PINs are in the README).
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { CREW } from '../crew'
import { MISSIONS, ROLES, initialsOf, type AccountProfile, type Role } from '../accounts'
import type { Astronaut } from '../crew'

interface StoredAccount extends AccountProfile {
  salt: string
  pinHash: string
  createdAt: string
}

export const DATA_DIR = process.env.ORBIT_DATA_DIR ?? path.join(os.homedir(), '.orbit-twin')
const FILE = path.join(DATA_DIR, 'accounts.json')

/** Demo PINs for the built-in crew. Change them before showing anyone real data. */
const DEMO_PINS: Record<string, string> = { sara: '2468', ahmed: '1357', lena: '8642', omar: '9753' }
const DEMO_MISSION = MISSIONS[0]

const MAX_TRIES = 5
const LOCK_MS = 5 * 60 * 1000

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString('hex')
}

function seedAccounts(): StoredAccount[] {
  return CREW.map((c) => {
    const salt = randomBytes(16).toString('hex')
    return {
      id: c.id,
      name: c.name,
      role: c.role as Role,
      initials: c.initials,
      figure: c.figure,
      mission: DEMO_MISSION.label,
      environmentId: DEMO_MISSION.environmentId,
      lastCheckIn: c.lastCheckIn,
      isNew: false,
      salt,
      pinHash: hashPin(DEMO_PINS[c.id] ?? '0000', salt),
      createdAt: new Date().toISOString(),
    }
  })
}

let cache: StoredAccount[] | null = null

function load(): StoredAccount[] {
  if (cache) return cache
  try {
    if (existsSync(FILE)) {
      cache = JSON.parse(readFileSync(FILE, 'utf8')) as StoredAccount[]
      return cache
    }
  } catch {
    // A broken file falls back to the demo crew below.
  }
  cache = seedAccounts()
  save()
  return cache
}

function save() {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(cache, null, 2))
  } catch {
    // Read-only hosting (for example serverless): accounts stay in memory.
  }
}

function toProfile(a: StoredAccount): AccountProfile {
  const { salt: _salt, pinHash: _hash, createdAt: _created, ...profile } = a
  return profile
}

export function listProfiles(): AccountProfile[] {
  return load().map(toProfile)
}

export function findProfile(id: string): AccountProfile | null {
  const a = load().find((x) => x.id === id)
  return a ? toProfile(a) : null
}

// ---------------------------------------------------------------------------
// PIN check with lockout
// ---------------------------------------------------------------------------

const failures = new Map<string, { count: number; lockedUntil: number }>()

export type LoginResult =
  | { ok: true; profile: AccountProfile }
  | { ok: false; reason: 'invalid'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; retryInSeconds: number }

export function verifyPin(id: string, pin: string): LoginResult {
  const now = Date.now()
  const state = failures.get(id) ?? { count: 0, lockedUntil: 0 }
  if (state.lockedUntil > now) {
    return { ok: false, reason: 'locked', retryInSeconds: Math.ceil((state.lockedUntil - now) / 1000) }
  }

  const account = load().find((a) => a.id === id)
  // Hash even when the account is unknown, so timing does not reveal which ids exist.
  const salt = account?.salt ?? 'unknown-account-salt'
  const given = Buffer.from(hashPin(String(pin), salt), 'hex')
  const expected = Buffer.from(account?.pinHash ?? '0'.repeat(64), 'hex')
  const match = account !== undefined && /^\d{4}$/.test(String(pin)) && timingSafeEqual(given, expected)

  if (match) {
    failures.delete(id)
    return { ok: true, profile: toProfile(account) }
  }

  const count = state.count + 1
  if (count >= MAX_TRIES) {
    failures.set(id, { count: 0, lockedUntil: now + LOCK_MS })
    return { ok: false, reason: 'locked', retryInSeconds: LOCK_MS / 1000 }
  }
  failures.set(id, { count, lockedUntil: 0 })
  return { ok: false, reason: 'invalid', attemptsLeft: MAX_TRIES - count }
}

// ---------------------------------------------------------------------------
// Sign-up
// ---------------------------------------------------------------------------

export interface SignUpInput {
  name: string
  role: string
  figure: string
  mission: string
  pin: string
}

export type SignUpResult = { ok: true; profile: AccountProfile } | { ok: false; error: string }

export function createAccount(input: SignUpInput): SignUpResult {
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 40) return { ok: false, error: 'Enter a name between 2 and 40 characters.' }
  if (!ROLES.includes(input.role as Role)) return { ok: false, error: 'Choose a crew role from the list.' }
  if (input.figure !== 'female' && input.figure !== 'male') return { ok: false, error: 'Choose a body type.' }
  const mission = MISSIONS.find((m) => m.label === input.mission)
  if (!mission) return { ok: false, error: 'Choose a mission from the list.' }
  if (!/^\d{4}$/.test(String(input.pin))) return { ok: false, error: 'Use exactly 4 digits for your PIN.' }

  const accounts = load()
  if (accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'A crew member with this name already exists. Sign in instead.' }
  }

  const base = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'crew'
  const id = `${base}-${randomBytes(2).toString('hex')}`
  const salt = randomBytes(16).toString('hex')
  const account: StoredAccount = {
    id,
    name,
    role: input.role as Role,
    initials: initialsOf(name),
    figure: input.figure as Astronaut['figure'],
    mission: mission.label,
    environmentId: mission.environmentId,
    lastCheckIn: 'Not yet',
    isNew: true,
    salt,
    pinHash: hashPin(String(input.pin), salt),
    createdAt: new Date().toISOString(),
  }
  accounts.push(account)
  save()
  return { ok: true, profile: toProfile(account) }
}
