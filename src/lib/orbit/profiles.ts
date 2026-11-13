/**
 * Crew profiles: shared types and helpers. Owner: Member 1 (sign-in / sign-up).
 *
 * Built-in sample crew live in `crew.ts` (always available, even with the server off).
 * Astronauts created through /signup are stored in the crew DATABASE (server/server.mjs, SQLite) and
 * fetched through `api/crew-api.ts`. PIN hashes never leave the server.
 */
import { CREW, MISSION_NAME, type Astronaut } from './crew'
import type { EnvironmentId } from './environments'
import type { MeasuredIndicatorId } from './indicators'
import type { BaselineSource } from './baseline'

export const CREW_ROLES = ['Commander', 'Flight Engineer', 'Mission Specialist', 'Crew Medical Officer'] as const

/**
 * The three missions are the three operating regimes the project plan asks us to demo
 * ("ISS / Moon / Mars communication-delay display and environment-aware contact routing").
 * Distance changes WHO you contact and how fast, never how serious a health finding is.
 */
export const MISSIONS = [
  {
    id: 'ares-iv',
    label: `${MISSION_NAME} · Mars transit`,
    envId: 'mars-transit',
    why: 'Deep space. Radio messages take roughly 3–22 minutes each way, depending on where Earth and Mars are, so there is no live call with a doctor. The crew must handle problems on board with the crew medical officer. It also has the most radiation and no gravity. This is the case ORBIT TWIN is built for.',
  },
  {
    id: 'artemis',
    label: 'Artemis · Lunar surface base',
    envId: 'moon-base',
    why: 'The next step outward. About 1.3 seconds delay each way, so talking to Earth is still possible but a little slow. One-sixth of Earth gravity, and more radiation than the ISS because the Moon has no magnetic field.',
  },
  {
    id: 'iss',
    label: 'ISS expedition · Low Earth orbit',
    envId: 'iss',
    why: 'Today’s reference point. Near real-time contact with flight surgeons on the ground, and Earth’s magnetic field blocks much of the radiation. Weightlessness still affects bones, muscles, heart and eyes, the same as on the trip to Mars.',
  },
] as const satisfies ReadonlyArray<{ id: string; label: string; envId: EnvironmentId; why: string }>

export type MissionId = (typeof MISSIONS)[number]['id']

export function getMission(id: string) {
  return MISSIONS.find((m) => m.id === id) ?? MISSIONS[0]
}

export interface DevicePairing {
  watch: string | null
  dosimeter: string | null
}

export interface NewCrewProfile {
  name: string
  role: string
  dob: string
  missionId: MissionId
  figure: Astronaut['figure']
  pin: string
  devices: DevicePairing
  baseline: Record<MeasuredIndicatorId, number>
  baselineSource: Partial<Record<MeasuredIndicatorId, BaselineSource>>
}

/** An astronaut as returned by the crew database API (no PIN hash). */
export interface CrewProfile extends Omit<NewCrewProfile, 'pin'> {
  id: string
  createdAt: string
}

export function nameTaken(name: string, profiles: CrewProfile[]) {
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase()
  return [...CREW.map((c) => c.name), ...profiles.map((p) => p.name)].some((n) => n.toLowerCase() === key)
}

export function isSampleCrew(astronautId: string) {
  return CREW.some((c) => c.id === astronautId)
}

/** Environment the twin should open in after this person signs in. */
export function environmentFor(astronautId: string, profiles: CrewProfile[]): EnvironmentId {
  const profile = profiles.find((p) => p.id === astronautId)
  return profile ? getMission(profile.missionId).envId : 'mars-transit'
}

// ---------- mapping to the shared Astronaut model ----------

export function profileToAstronaut(profile: CrewProfile): Astronaut {
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    initials: initialsFor(profile.name),
    figure: profile.figure,
    lastCheckIn: 'Not yet',
    seed: seedFor(profile.id),
    streak: 0,
    baseline: { ...profile.baseline },
    drift: {},
    today: {},
    crewVotes: [],
    pulseTargetId: CREW[0].id,
  }
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? 'C') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  return letters.toUpperCase()
}

function seedFor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000
  return 1 + h / 50
}
