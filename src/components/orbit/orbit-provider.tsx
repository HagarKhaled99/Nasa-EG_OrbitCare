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
 *  - Live watch: the mock sensor adapter sends a heart-rate/SpO₂ packet every 5 s; only good-quality packets
 *    update the twin (motion artefacts are shown but ignored).
 *  - Symptoms: urgent symptoms from today's check-in raise Act on their body system even if numbers look normal.
 *  - Crew Pulse + Medical Report Packets (Member 5): stored on the server. You only get the combined count of
 *    what the crew said about you, never who said it.
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
import { worstStatus } from '@/lib/orbit/health'
import {
  fetchCrewPulse,
  fetchReports,
  queueReport,
  sendCrewPulseVote,
  type CrewPulseDay,
  type MedicalReport,
} from '@/lib/orbit/api/actions-api'
import { symptomLevels, type SymptomId } from '@/lib/orbit/symptoms'
import {
  WATCH_POLL_MS,
  WATCH_STALE_MS,
  latestGood,
  nextWatchSample,
  type WatchCentre,
  type WatchSample,
} from '@/lib/orbit/sensor-adapter'

/** Connection state of the crew database server. */
export type CrewDbStatus = 'loading' | 'online' | 'offline'
/** 'checking' while asking the server who is signed in (page load). */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out'
/** Where the twin's numbers come from right now. */
export type ReadingsStatus = 'idle' | 'loading' | 'database' | 'built-in'

type Overrides = Partial<Record<MeasuredIndicatorId, number>>

export interface WatchStream {
  /** Newest packets first is NOT guaranteed: oldest first, last 24 kept. */
  samples: WatchSample[]
  /** Latest good-quality value per measurement (what the twin uses). */
  good: ReturnType<typeof latestGood>
  /** No good packet for 30 s. */
  stale: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
}

export interface CheckInExtras {
  symptoms?: SymptomId[]
}

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
  /**
   * Record today's values: the twin updates at once and a MANUAL_CHECKIN row is saved to the database.
   * Resolves to where it was saved: 'database', 'tablet-only' (server unreachable or value not stored in the
   * readings table, e.g. grip/vision/glucose), so the page can tell the astronaut honestly.
   */
  submitCheckIn: (values: Overrides, extras?: CheckInExtras) => Promise<'database' | 'tablet-only'>
  /** Live simulated watch feed (mock sensor adapter). */
  watch: WatchStream
  /** Symptoms reported at today's check-in. */
  symptomsToday: SymptomId[]
  /** Answer today's Crew Pulse question about a crewmate (saved on the server as you). */
  castVote: (targetId: string, seemsLikeThemselves: boolean) => Promise<void>
  myVoteFor: (targetId: string) => boolean | undefined
  /** Crewmates who have answered today's Crew Pulse (participation only, never the answers). */
  crewAnswered: string[]
  /** Medical Report Packets queued today. */
  reportsSent: number
  /** Queue a Medical Report Packet for Earth. Resolves to where it was stored. */
  sendReport: (report: MedicalReport['report']) => Promise<'database' | 'tablet-only'>
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
  const [localSymptoms, setLocalSymptoms] = useState<Record<string, SymptomId[]>>({})
  const [samples, setSamples] = useState<WatchSample[]>([])
  const [watchPaused, setWatchPaused] = useState(false)
  const [voteChanges, setVoteChanges] = useState<Record<string, Record<string, boolean>>>({})
  const [reports, setReports] = useState<Record<string, number>>({})

  const astronaut = crew.find((member) => member.id === astronautId) ?? crew[0]
  const env = getEnvironment(envId)

  const submitCheckIn = useCallback(
    async (values: Overrides, extras: CheckInExtras = {}): Promise<'database' | 'tablet-only'> => {
      const id = astronaut.id
      setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...values } }))
      const symptoms = extras.symptoms ?? []
      setLocalSymptoms((prev) => ({ ...prev, [id]: symptoms }))
      const row: NewReading = { astronaut_id: id, mission_day: MISSION_DAY, data_origin: 'MANUAL_CHECKIN', sensor_mode: 'manual' }
      let any = false
      for (const [indicator, value] of Object.entries(values) as Array<[MeasuredIndicatorId, number]>) {
        const column = CHECK_IN_COLUMN[indicator]
        if (column && Number.isFinite(value)) {
          ;(row as Record<string, unknown>)[column] = value
          any = true
        }
      }
      if (symptoms.length > 0) {
        row.symptoms = symptoms
        any = true
      }
      if (!any) return 'tablet-only'
      try {
        await saveReading(row)
        // Store the watch values the astronaut saw at check-in time (latest good packets).
        const good = latestGood(samples)
        if (good.heartRate || good.spo2) {
          await saveReading({
            astronaut_id: id,
            mission_day: MISSION_DAY,
            data_origin: 'SIMULATED_WATCH',
            sensor_mode: 'rest',
            quality: 'good',
            heart_rate_bpm: good.heartRate?.value ?? null,
            spo2_pct: good.spo2?.value ?? null,
          })
        }
        await loadReadings(id)
        return 'database'
      } catch {
        // Server unreachable: the check-in still shows on this tablet; it is not lost from the screen.
        return 'tablet-only'
      }
    },
    [astronaut.id, loadReadings, samples],
  )

  // ---------- Member 5: Crew Pulse + report packets from the server ----------
  const [pulse, setPulse] = useState<CrewPulseDay | null>(null)
  const [reportsToday, setReportsToday] = useState(0)

  const loadMemberFive = useCallback(async () => {
    try {
      setPulse(await fetchCrewPulse(MISSION_DAY))
    } catch {
      setPulse(null) // offline: fall back to the demo votes in crew.ts
    }
    try {
      const today = new Date().toDateString()
      setReportsToday((await fetchReports()).filter((r) => new Date(r.created_at).toDateString() === today).length)
    } catch {
      /* keep the tablet count */
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setPulse(null)
      setReportsToday(0)
      return
    }
    void loadMemberFive()
  }, [session, loadMemberFive])

  const castVote = useCallback(
    async (targetId: string, seems: boolean) => {
      setVoteChanges((prev) => ({ ...prev, [targetId]: { ...prev[targetId], [astronautId]: seems } }))
      try {
        await sendCrewPulseVote(MISSION_DAY, targetId, seems)
        await loadMemberFive()
      } catch {
        /* offline: the answer stays on this tablet */
      }
    },
    [astronautId, loadMemberFive],
  )

  const sendReport = useCallback(
    async (report: MedicalReport['report']): Promise<'database' | 'tablet-only'> => {
      setReports((prev) => ({ ...prev, [astronautId]: (prev[astronautId] ?? 0) + 1 }))
      try {
        await queueReport(report)
        await loadMemberFive()
        setReports((prev) => ({ ...prev, [astronautId]: 0 }))
        return 'database'
      } catch {
        return 'tablet-only'
      }
    },
    [astronautId, loadMemberFive],
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

  // From the server: only the combined count about me, turned into anonymous votes for the health engine.
  const votes = useMemo<CrewVote[]>(() => {
    if (!pulse) return votesFor(astronautId)
    const { flags, total } = pulse.aboutMe
    return Array.from({ length: total }, (_, i) => ({ fromId: `crewmate-${i + 1}`, seemsLikeThemselves: i >= flags }))
  }, [pulse, votesFor, astronautId])
  const checkedInToday =
    Boolean(overrides[astronautId]) ||
    readings.some((r) => r.data_origin === 'MANUAL_CHECKIN' && r.mission_day === MISSION_DAY)
  const readingHistory = useMemo(() => toReadingHistory(readings), [readings])

  // Today's centre for the simulated watch: the database value for today (null = no signal today).
  const watchCentre = useMemo<WatchCentre>(() => {
    const today = (id: 'heartRate' | 'spo2') => {
      const points = readingHistory[id]
      const last = points?.[points.length - 1]
      if (last && last.day === MISSION_DAY) return last.value
      return astronaut.today[id] ?? astronaut.baseline[id]
    }
    return { heartRate: today('heartRate'), spo2: today('spo2') }
  }, [readingHistory, astronaut])

  // Mock polling: one packet every 5 s while someone is signed in.
  useEffect(() => {
    setSamples([])
  }, [astronautId])
  useEffect(() => {
    if (!session || watchPaused) return
    const push = () => setSamples((prev) => [...prev.slice(-23), nextWatchSample(watchCentre)])
    push()
    const timer = window.setInterval(push, WATCH_POLL_MS)
    return () => window.clearInterval(timer)
  }, [session, watchPaused, watchCentre])

  const watchGood = useMemo(() => latestGood(samples), [samples])
  const newestGood = Math.max(watchGood.heartRate?.at ?? 0, watchGood.spo2?.at ?? 0)
  const lastPacket = samples[samples.length - 1]?.at ?? 0
  const watchStale = samples.length > 0 && lastPacket - newestGood > WATCH_STALE_MS
  // Live values feed the twin (good packets only); a manual check-in value for the same field wins.
  const liveOverrides = useMemo<Overrides>(() => {
    const out: Overrides = {}
    if (watchStale) return out
    if (watchGood.heartRate) out.heartRate = watchGood.heartRate.value
    if (watchGood.spo2) out.spo2 = watchGood.spo2.value
    return out
  }, [watchGood, watchStale])

  // Today's symptoms: this tablet's latest check-in, else the latest check-in stored in the database.
  const symptomsToday = useMemo<SymptomId[]>(() => {
    if (localSymptoms[astronautId]) return localSymptoms[astronautId]
    const row = [...readings].reverse().find((r) => r.mission_day === MISSION_DAY && r.data_origin === 'MANUAL_CHECKIN')
    return row?.symptoms ?? []
  }, [localSymptoms, astronautId, readings])

  const value = useMemo<OrbitContextValue>(() => {
    const indicators = computeIndicators({
      astronaut,
      env,
      overrides: { ...liveOverrides, ...(overrides[astronaut.id] ?? {}) },
      votes,
      readings: readingHistory,
    })
    // Urgent symptoms raise their body system even when the numbers look normal (plan §7).
    const reported = symptomLevels(symptomsToday)
    const organs = computeOrgans(indicators).map((o) => {
      const symptom = reported[o.organ.id]
      return symptom ? { ...o, status: worstStatus([o.status, symptom.level]) } : o
    })
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
      watch: { samples, good: watchGood, stale: watchStale, paused: watchPaused, setPaused: setWatchPaused },
      symptomsToday,
      castVote,
      myVoteFor: (targetId) =>
        voteChanges[targetId]?.[astronaut.id] ?? pulse?.mine.find((v) => v.targetId === targetId)?.seemsLikeThemselves,
      crewAnswered: [...new Set([...(pulse?.answered ?? []), ...Object.values(voteChanges).flatMap((v) => Object.keys(v))])],
      reportsSent: reportsToday + (reports[astronaut.id] ?? 0),
      sendReport,
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
    pulse,
    reportsToday,
    castVote,
    sendReport,
    session,
    sessionStatus,
    signIn,
    signOut,
    createCrewProfile,
    removeCrewMember,
    submitCheckIn,
    liveOverrides,
    symptomsToday,
    samples,
    watchGood,
    watchStale,
    watchPaused,
  ])

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}

export function useOrbit() {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside OrbitProvider')
  return ctx
}

export { CREW }
