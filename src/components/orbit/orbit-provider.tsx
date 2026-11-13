/**
 * Shared app state (every page reads it with `useOrbit()`).
 *
 * Linked pieces:
 *  - Session: from the server's signed httpOnly cookie (GET /api/auth/session). Only the signed-in person's twin
 *    is ever loaded. There is no person switcher (privacy rule from Member 2).
 *  - Crew list: built-in sample crew (crew.ts) + astronauts in the crew database (GET /api/astronauts).
 *  - Readings: the signed-in astronaut's daily vitals from the database (GET /api/readings) drive the twin's
 *    history and today's values. Missing values stay missing (UNKNOWN), never "normal".
 *  - Check-in: `submitCheckIn` updates the twin instantly AND saves a MANUAL_CHECKIN row in the database.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CREW, MISSION_DAY, type Astronaut, type CrewVote } from '@/lib/orbit/crew'
import { environmentFor, profileToAstronaut, type CrewProfile, type NewCrewProfile } from '@/lib/orbit/profiles'
import { forgetSignIn, recordSignIn, type Session, type SignInResult } from '@/lib/orbit/auth/auth-service'
import {
  createAstronaut,
  deleteAstronaut,
  fetchAstronauts,
  fetchSession,
  signInAstronaut,
  signOutSession,
} from '@/lib/orbit/api/crew-api'
import { fetchReadings, saveReading, toReadingHistory, type NewReading, type Reading } from '@/lib/orbit/api/readings-api'
import { getEnvironment, type EnvironmentId, type MissionEnvironment } from '@/lib/orbit/environments'
import {
  computeIndicators,
  computeOrgans,
  readinessScore,
  STATUS_RANK,
  type IndicatorState,
  type OrganState,
} from '@/lib/orbit/health'
import type { IndicatorId, MeasuredIndicatorId } from '@/lib/orbit/indicators'

/** Connection state of the crew database server. */
export type CrewDbStatus = 'loading' | 'online' | 'offline'
/** 'checking' while asking the server who is signed in (page load). */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out'
/** Where the twin's numbers come from right now. */
export type ReadingsStatus = 'idle' | 'loading' | 'database' | 'built-in'

type Overrides = Partial<Record<MeasuredIndicatorId, number>>

/** Check-in indicator → database column (Member 4's check-in page calls submitCheckIn with indicator ids). */
const CHECK_IN_COLUMN: Partial<Record<MeasuredIndicatorId, keyof NewReading>> = {
  heartRate: 'heart_rate_bpm',
  spo2: 'spo2_pct',
  systolic: 'blood_pressure_systolic_mmhg',
  diastolic: 'blood_pressure_diastolic_mmhg',
  temperature: 'temperature_c',
  sleep: 'sleep_hours',
  mood: 'mood_1_to_5',
  exercise: 'activity_min',
}

interface OrbitContextValue {
  /** The signed-in astronaut (behind the route guard this is always the session's person). */
  astronaut: Astronaut
  crew: Astronaut[]
  /** Astronauts stored in the crew database (empty while loading or offline). */
  profiles: CrewProfile[]
  crewDbStatus: CrewDbStatus
  /** Re-fetch the crew list from the database. */
  refreshCrew: () => Promise<void>
  env: MissionEnvironment
  indicators: Record<IndicatorId, IndicatorState>
  organs: OrganState[]
  alerts: OrganState[]
  readiness: number
  streak: number
  checkedInToday: boolean
  votes: CrewVote[]
  /** Raw database readings for the signed-in astronaut (oldest first). */
  readings: Reading[]
  readingsStatus: ReadingsStatus
  session: Session | null
  sessionStatus: SessionStatus
  /** Server checks the PIN; on success the session cookie is set and the twin opens in the person's mission. */
  signIn: (astronautId: string, pin: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  /** Save a new astronaut in the database; the server signs them in. Throws ApiError / ApiUnavailableError. */
  createCrewProfile: (input: NewCrewProfile) => Promise<CrewProfile>
  /** Delete an astronaut from the database. `pin` = their own PIN or the admin PIN. Throws ApiError 403 if refused. */
  removeCrewMember: (astronautId: string, pin: string) => Promise<void>
  setEnvironmentId: (id: EnvironmentId) => void
  /** Record today's values: the twin updates at once and a MANUAL_CHECKIN row is saved to the database. */
  submitCheckIn: (values: Overrides) => Promise<void>
  castVote: (targetId: string, seemsLikeThemselves: boolean) => void
  myVoteFor: (targetId: string) => boolean | undefined
  reportsSent: number
  sendReport: () => void
}

const OrbitContext = createContext<OrbitContextValue | null>(null)

export function OrbitProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking')
  const [profiles, setProfiles] = useState<CrewProfile[]>([])
  const [crewDbStatus, setCrewDbStatus] = useState<CrewDbStatus>('loading')
  const [envId, setEnvironmentId] = useState<EnvironmentId>('mars-transit')
  const [readings, setReadings] = useState<Reading[]>([])
  const [readingsStatus, setReadingsStatus] = useState<ReadingsStatus>('idle')
  const crew = useMemo(() => [...CREW, ...profiles.map(profileToAstronaut)], [profiles])

  const refreshCrew = useCallback(async () => {
    try {
      const list = await fetchAstronauts()
      setProfiles(list)
      setCrewDbStatus('online')
    } catch {
      setCrewDbStatus('offline')
    }
  }, [])

  // Start-up: load the crew list and ask the server who is signed in (the cookie is invisible to scripts).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let list: CrewProfile[] = []
      try {
        list = await fetchAstronauts()
        if (!cancelled) {
          setProfiles(list)
          setCrewDbStatus('online')
        }
      } catch {
        if (!cancelled) setCrewDbStatus('offline')
      }
      try {
        const current = await fetchSession()
        if (cancelled) return
        setSession(current)
        setSessionStatus(current ? 'signed-in' : 'signed-out')
        if (current) setEnvironmentId(environmentFor(current.astronautId, list))
      } catch {
        if (!cancelled) setSessionStatus('signed-out')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const astronautId = session?.astronautId ?? CREW[0].id

  // Load the signed-in astronaut's readings from the database whenever the person changes.
  const loadReadings = useCallback(async (id: string) => {
    setReadingsStatus('loading')
    try {
      const rows = await fetchReadings(id)
      setReadings(rows)
      setReadingsStatus(rows.length > 0 ? 'database' : 'built-in')
    } catch {
      setReadings([])
      setReadingsStatus('built-in')
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setReadings([])
      setReadingsStatus('idle')
      return
    }
    void loadReadings(session.astronautId)
  }, [session, loadReadings])

  const startedSession = useCallback((next: Session, nextProfiles: CrewProfile[]) => {
    recordSignIn(next.astronautId)
    setSession(next)
    setSessionStatus('signed-in')
    setEnvironmentId(environmentFor(next.astronautId, nextProfiles))
  }, [])

  const signIn = useCallback(
    async (id: string, pin: string): Promise<SignInResult> => {
      try {
        const result = await signInAstronaut(id, pin)
        if (result.ok) startedSession(result.session, profiles)
        return result
      } catch (error) {
        return {
          ok: false,
          reason: 'server-unavailable',
          message: error instanceof Error ? error.message : 'Crew database error',
        }
      }
    },
    [profiles, startedSession],
  )

  const signOut = useCallback(async () => {
    try {
      await signOutSession()
    } catch {
      /* server unreachable: the local state is still cleared below */
    }
    setSession(null)
    setSessionStatus('signed-out')
  }, [])

  const createCrewProfile = useCallback(
    async (input: NewCrewProfile) => {
      const { session: next, ...profile } = await createAstronaut(input)
      const nextProfiles = [...profiles.filter((p) => p.id !== profile.id), profile]
      setProfiles(nextProfiles)
      setCrewDbStatus('online')
      startedSession(next, nextProfiles)
      return profile
    },
    [profiles, startedSession],
  )

  const removeCrewMember = useCallback(
    async (id: string, pin: string) => {
      await deleteAstronaut(id, pin)
      forgetSignIn(id)
      setProfiles((current) => current.filter((p) => p.id !== id))
      if (session?.astronautId === id) {
        setSession(null)
        setSessionStatus('signed-out')
      }
    },
    [session],
  )

  const [overrides, setOverrides] = useState<Record<string, Overrides>>({})
  const [voteChanges, setVoteChanges] = useState<Record<string, Record<string, boolean>>>({})
  const [reports, setReports] = useState<Record<string, number>>({})

  const astronaut = crew.find((member) => member.id === astronautId) ?? crew[0]
  const env = getEnvironment(envId)

  const submitCheckIn = useCallback(
    async (values: Overrides) => {
      const id = astronaut.id
      setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...values } }))
      const row: NewReading = { astronaut_id: id, mission_day: MISSION_DAY, data_origin: 'MANUAL_CHECKIN', sensor_mode: 'manual' }
      let any = false
      for (const [indicator, value] of Object.entries(values) as Array<[MeasuredIndicatorId, number]>) {
        const column = CHECK_IN_COLUMN[indicator]
        if (column && Number.isFinite(value)) {
          ;(row as Record<string, unknown>)[column] = value
          any = true
        }
      }
      if (!any) return
      try {
        await saveReading(row)
        await loadReadings(id)
      } catch {
        /* offline: the check-in still shows on this tablet; it is not lost from the screen */
      }
    },
    [astronaut.id, loadReadings],
  )

  const votesFor = useCallback(
    (targetId: string): CrewVote[] => {
      const target = crew.find((member) => member.id === targetId) ?? crew[0]
      const changes = voteChanges[targetId] ?? {}
      const merged = target.crewVotes.map((v) =>
        v.fromId in changes ? { ...v, seemsLikeThemselves: changes[v.fromId] } : v,
      )
      for (const [fromId, value] of Object.entries(changes)) {
        if (!merged.some((v) => v.fromId === fromId)) {
          merged.push({ fromId, seemsLikeThemselves: value })
        }
      }
      return merged
    },
    [voteChanges, crew],
  )

  const votes = useMemo(() => votesFor(astronautId), [votesFor, astronautId])
  const checkedInToday =
    Boolean(overrides[astronautId]) ||
    readings.some((r) => r.data_origin === 'MANUAL_CHECKIN' && r.mission_day === MISSION_DAY)
  const readingHistory = useMemo(() => toReadingHistory(readings), [readings])

  const value = useMemo<OrbitContextValue>(() => {
    const indicators = computeIndicators({
      astronaut,
      env,
      overrides: overrides[astronaut.id] ?? {},
      votes,
      readings: readingHistory,
    })
    const organs = computeOrgans(indicators)
    const alerts = organs
      .filter((o) => o.status !== 'normal')
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])
    return {
      astronaut,
      crew,
      profiles,
      crewDbStatus,
      refreshCrew,
      env,
      indicators,
      organs,
      alerts,
      readiness: readinessScore(organs, checkedInToday),
      streak: astronaut.streak + (checkedInToday ? 1 : 0),
      checkedInToday,
      votes,
      readings,
      readingsStatus,
      session,
      sessionStatus,
      signIn,
      signOut,
      createCrewProfile,
      removeCrewMember,
      setEnvironmentId,
      submitCheckIn,
      castVote: (targetId, seems) =>
        setVoteChanges((prev) => ({
          ...prev,
          [targetId]: { ...prev[targetId], [astronaut.id]: seems },
        })),
      myVoteFor: (targetId) => voteChanges[targetId]?.[astronaut.id],
      reportsSent: reports[astronaut.id] ?? 0,
      sendReport: () => setReports((prev) => ({ ...prev, [astronaut.id]: (prev[astronaut.id] ?? 0) + 1 })),
    }
  }, [
    astronaut,
    crew,
    profiles,
    crewDbStatus,
    refreshCrew,
    env,
    overrides,
    votes,
    readingHistory,
    readings,
    readingsStatus,
    checkedInToday,
    voteChanges,
    reports,
    session,
    sessionStatus,
    signIn,
    signOut,
    createCrewProfile,
    removeCrewMember,
    submitCheckIn,
  ])

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}

export function useOrbit() {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside OrbitProvider')
  return ctx
}

export { CREW }
