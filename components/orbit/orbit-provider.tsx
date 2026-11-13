'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CREW, getAstronaut, type Astronaut, type CrewVote } from '@/lib/orbit/crew'
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
  env: MissionEnvironment
  indicators: Record<IndicatorId, IndicatorState>
  organs: OrganState[]
  alerts: OrganState[]
  readiness: number
  streak: number
  checkedInToday: boolean
  votes: CrewVote[]
  setAstronautId: (id: string) => void
  setEnvironmentId: (id: EnvironmentId) => void
  submitCheckIn: (values: Overrides) => void
  castVote: (targetId: string, seemsLikeThemselves: boolean) => void
  myVoteFor: (targetId: string) => boolean | undefined
  reportsSent: number
  sendReport: () => void
}

const OrbitContext = createContext<OrbitContextValue | null>(null)

export function OrbitProvider({ children }: { children: React.ReactNode }) {
  const [astronautId, setAstronautId] = useState('sara')
  const [envId, setEnvironmentId] = useState<EnvironmentId>('mars-transit')
  const [overrides, setOverrides] = useState<Record<string, Overrides>>({})
  const [voteChanges, setVoteChanges] = useState<Record<string, Record<string, boolean>>>({})
  const [reports, setReports] = useState<Record<string, number>>({})

  const astronaut = getAstronaut(astronautId)
  const env = getEnvironment(envId)

  const votesFor = useCallback(
    (targetId: string): CrewVote[] => {
      const target = getAstronaut(targetId)
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
    [voteChanges],
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
      env,
      indicators,
      organs,
      alerts,
      readiness: readinessScore(organs, checkedInToday),
      streak: astronaut.streak + (checkedInToday ? 1 : 0),
      checkedInToday,
      votes,
      setAstronautId,
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
  }, [astronaut, env, overrides, votes, checkedInToday, voteChanges, reports])

  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>
}

export function useOrbit() {
  const ctx = useContext(OrbitContext)
  if (!ctx) throw new Error('useOrbit must be used inside OrbitProvider')
  return ctx
}

export { CREW }
