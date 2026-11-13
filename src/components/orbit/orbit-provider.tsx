import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { CREW, type Astronaut, type CrewVote } from '@/lib/orbit/crew'
import {
  environmentFor,
  isSampleCrew,
  profileToAstronaut,
  type CrewProfile,
  type NewCrewProfile,
} from '@/lib/orbit/profiles'
import {
  demoCrewCredential,
  endSession,
  loadSession,
  signInWithPin,
  startSession,
  type Session,
  type SignInResult,
} from '@/lib/orbit/auth/auth-service'
import {
  createAstronaut,
  deleteAstronaut,
  fetchAstronauts,
  signInAstronaut,
} from '@/lib/orbit/api/crew-api'

/** Connection state of the crew database server. Sample crew work in every state. */
export type CrewDbStatus = 'loading' | 'online' | 'offline'
import {
  getEnvironment,
  type EnvironmentId,
  type MissionEnvironment,
} from '@/lib/orbit/environments'
import {
  computeIndicators,
  computeOrgans,
  readinessScore,
  STATUS_RANK,
  type IndicatorState,
  type OrganState,
} from '@/lib/orbit/health'
import type { IndicatorId, MeasuredIndicatorId } from '@/lib/orbit/indicators'

type Overrides = Partial<Record<MeasuredIndicatorId, number>>

interface OrbitContextValue {
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
  setAstronautId: (id: string) => void
  /** Signed-in session (null = signed out). Pages behind the route guard can assume it is set. */
  session: Session | null
  /** Check a PIN and, on success, start a session and open the twin in that person's mission environment. */
  signIn: (astronautId: string, pin: string) => Promise<SignInResult>
  signOut: () => void
  /** Save a new astronaut in the database and sign them in. Throws ApiError (e.g. 409 duplicate) or ApiUnavailableError. */
  createCrewProfile: (input: NewCrewProfile) => Promise<CrewProfile>
  /** Delete an astronaut from the database. `pin` = their own PIN or the admin PIN. Throws ApiError 403 if refused. */
  removeCrewMember: (astronautId: string, pin: string) => Promise<void>
  setEnvironmentId: (id: EnvironmentId) => void
  submitCheckIn: (values: Overrides) => void
  castVote: (targetId: string, seemsLikeThemselves: boolean) => void
  myVoteFor: (targetId: string) => boolean | undefined
  reportsSent: number
  sendReport: () => void
}

const OrbitContext = createContext<OrbitContextValue | null>(null)

export function OrbitProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const [astronautId, setActiveId] = useState(() => session?.astronautId ?? 'sara')
  const [profiles, setProfiles] = useState<CrewProfile[]>([])
  const [crewDbStatus, setCrewDbStatus] = useState<CrewDbStatus>('loading')
  const crew = useMemo(() => [...CREW, ...profiles.map(profileToAstronaut)], [profiles])
  const [envId, setEnvironmentId] = useState<EnvironmentId>('mars-transit')

  const refreshCrew = useCallback(async () => {
    try {
      const list = await fetchAstronauts()
      setProfiles(list)
      setCrewDbStatus('online')
    } catch {
      setCrewDbStatus('offline')
    }
  }, [])

  // Load the crew list from the database once at start-up.
  useEffect(() => {
    void refreshCrew()
  }, [refreshCrew])

  // After a page refresh, reopen the signed-in astronaut's mission environment once their profile is loaded.
  useEffect(() => {
    if (session && crewDbStatus !== 'loading') setEnvironmentId(environmentFor(session.astronautId, profiles))
  }, [crewDbStatus])

  /** Demo convenience (top-bar crew switcher): switching person keeps the session but moves it to them. */
  const setAstronautId = useCallback((id: string) => {
    setActiveId(id)
    setSession((current) => (current ? startSession(id) : current))
  }, [])

  const signIn = useCallback(
    async (id: string, pin: string): Promise<SignInResult> => {
      let result: SignInResult
      if (isSampleCrew(id)) {
        // Sample crew: checked locally so the judge demo works even with the server off.
        result = signInWithPin(id, pin, demoCrewCredential())
      } else {
        try {
          const server = await signInAstronaut(id, pin)
          result = server.ok ? { ok: true, session: startSession(id) } : server
        } catch (error) {
          return {
            ok: false,
            reason: 'server-unavailable',
            message: error instanceof Error ? error.message : 'Crew database error',
          }
        }
      }
      if (result.ok) {
        setSession(result.session)
        setActiveId(id)
        setEnvironmentId(environmentFor(id, profiles))
      }
      return result
    },
    [profiles],
  )

  const signOut = useCallback(() => {
    endSession()
    setSession(null)
  }, [])

  const createCrewProfile = useCallback(async (input: NewCrewProfile) => {
    const profile = await createAstronaut(input)
    const nextProfiles = [...profiles.filter((p) => p.id !== profile.id), profile]
    setProfiles(nextProfiles)
    setCrewDbStatus('online')
    setSession(startSession(profile.id))
    setActiveId(profile.id)
    setEnvironmentId(environmentFor(profile.id, nextProfiles))
    return profile
  }, [profiles])

  const removeCrewMember = useCallback(
    async (id: string, pin: string) => {
      await deleteAstronaut(id, pin)
      setProfiles((current) => current.filter((p) => p.id !== id))
      if (session?.astronautId === id) {
        endSession()
        setSession(null)
        setActiveId(CREW[0].id)
      }
    },
    [session],
  )

  const [overrides, setOverrides] = useState<Record<string, Overrides>>({})
  const [voteChanges, setVoteChanges] = useState<Record<string, Record<string, boolean>>>({})
  const [reports, setReports] = useState<Record<string, number>>({})

  const astronaut = crew.find((member) => member.id === astronautId) ?? crew[0]
  const env = getEnvironment(envId)

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
  const checkedInToday = Boolean(overrides[astronautId])

  const value = useMemo<OrbitContextValue>(() => {
    const indicators = computeIndicators({
      astronaut,
      env,
      overrides: overrides[astronaut.id] ?? {},
      votes,
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
      setAstronautId,
      session,
      signIn,
      signOut,
      createCrewProfile,
      removeCrewMember,
      setEnvironmentId,
      submitCheckIn: (values) =>
        setOverrides((prev) => ({ ...prev, [astronaut.id]: { ...prev[astronaut.id], ...values } })),
      castVote: (targetId, seems) =>
        setVoteChanges((prev) => ({
          ...prev,
          [targetId]: { ...prev[targetId], [astronaut.id]: seems },
        })),
      myVoteFor: (targetId) => voteChanges[targetId]?.[astronaut.id],
      reportsSent: reports[astronaut.id] ?? 0,
      sendReport: () =>
        setReports((prev) => ({ ...prev, [astronaut.id]: (prev[astronaut.id] ?? 0) + 1 })),
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
    checkedInToday,
    voteChanges,
    reports,
    session,
    setAstronautId,
    signIn,
    signOut,
    createCrewProfile,
    removeCrewMember,
  ])

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}

export function useOrbit() {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside OrbitProvider')
  return ctx
}

export { CREW }
