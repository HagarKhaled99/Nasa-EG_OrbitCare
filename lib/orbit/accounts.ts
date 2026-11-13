/**
 * Account profiles (shared by browser and server).
 *
 * A profile is the public part of an account: no PIN, no hash. The server
 * keeps the secret part (see lib/orbit/server/accounts-store.ts).
 */
import { CREW, type Astronaut } from './crew'
import type { EnvironmentId } from './environments'

export const ROLES = ['Commander', 'Flight Engineer', 'Mission Specialist', 'Crew Medical Officer'] as const
export type Role = (typeof ROLES)[number]

/** Missions offered at sign-up and the environment each one starts in. */
export const MISSIONS: { label: string; environmentId: EnvironmentId }[] = [
  { label: 'ARES-IV · Mars transit', environmentId: 'mars-transit' },
  { label: 'Artemis · Lunar base', environmentId: 'moon-base' },
  { label: 'ISS expedition', environmentId: 'iss' },
]

export interface AccountProfile {
  id: string
  name: string
  role: Role
  initials: string
  figure: Astronaut['figure']
  mission: string
  environmentId: EnvironmentId
  lastCheckIn: string
  /** True for accounts created at sign-up: their baseline is still being learned. */
  isNew: boolean
}

/** Provisional pre-flight baseline for a new account, until 30 days of watch data exist. */
const DEFAULT_BASELINE: Record<Astronaut['figure'], Astronaut['baseline']> = {
  female: {
    heartRate: 64,
    systolic: 114,
    diastolic: 73,
    glucose: 90,
    temperature: 36.7,
    sleep: 7.5,
    mood: 4,
    exercise: 150,
    grip: 32,
    vision: 10,
  },
  male: {
    heartRate: 60,
    systolic: 120,
    diastolic: 78,
    glucose: 94,
    temperature: 36.7,
    sleep: 7,
    mood: 4,
    exercise: 150,
    grip: 45,
    vision: 10,
  },
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function seedFrom(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997
  return 1 + h / 50
}

/**
 * The Astronaut record the health engine runs on. Built-in crew use their
 * demo history from crew.ts; new accounts start from the provisional baseline
 * for their body type, with no drift and no crew votes yet.
 */
export function astronautFromProfile(profile: AccountProfile): Astronaut {
  const crew = CREW.find((c) => c.id === profile.id)
  if (crew) return { ...crew, figure: profile.figure }
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    initials: profile.initials,
    figure: profile.figure,
    lastCheckIn: profile.lastCheckIn,
    seed: seedFrom(profile.id),
    streak: 0,
    baseline: { ...DEFAULT_BASELINE[profile.figure] },
    drift: {},
    today: {},
    crewVotes: [],
    pulseTargetId: CREW[0].id,
  }
}
