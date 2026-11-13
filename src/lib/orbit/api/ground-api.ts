/**
 * Ground portal (Earth) + astronaut inbox API client.
 *
 * Roles, enforced by the server:
 *  - Flight surgeon (access 'medical'): crew overview with medical fields, readings, report packets, sends advice,
 *    decides fitness for duty.
 *  - Mission director (access 'readiness'): crew overview with fitness for duty only. Never medical data.
 * Messages and report packets travel with the one-way light delay of the astronaut's mission.
 */
import { ApiError, ApiUnavailableError } from './crew-api'

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiUnavailableError()
  }
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new ApiUnavailableError()
  }
  if (!res.ok) {
    if (res.status >= 500 && !data) throw new ApiUnavailableError()
    const err = (data ?? {}) as { error?: string; errors?: string[] }
    throw new ApiError(res.status, err.error ?? `Request failed (${res.status})`, err.errors ?? [])
  }
  return data as T
}

export type FitnessStatus = 'ready' | 'limited' | 'not-ready'

export const FITNESS_LABEL: Record<FitnessStatus, string> = {
  ready: 'Ready for duty',
  limited: 'Limited duty',
  'not-ready': 'Not ready for duty',
}

export interface FitnessDecision {
  id: string
  astronaut_id: string
  status: FitnessStatus
  restrictions: string | null
  /** Flight surgeon and the astronaut only. Never sent to the mission director. */
  medical_note?: string | null
  decided_by: string
  decided_at: string
}

export interface GroundCrewRow {
  id: string
  name: string
  role: string
  missionId: string
  signedUp: boolean
  delaySeconds: number
  lastDataAt: string | null
  fitness: { status: FitnessStatus; restrictions: string | null; decidedBy: string; decidedAt: string } | null
  /** Flight surgeon only. */
  reportsArrived?: number
  reportsInTransit?: number
}

export interface GroundMessage {
  id: string
  astronaut_id: string
  from_id: string
  from_name: string
  /** null while the message is still crossing space (astronaut side). */
  body: string | null
  sent_at: string
  arrives_at: string
  read_at: string | null
  arrived?: boolean
}

export interface ReceivedReport {
  id: string
  createdAt: string
  arrivesAt: string
  arrived: boolean
  report: { text: string; [key: string]: unknown } | null
}

export const fetchGroundCrew = () => call<GroundCrewRow[]>('GET', '/ground/crew')
export const fetchGroundThread = (astronautId: string) =>
  call<{ delaySeconds: number; messages: GroundMessage[]; reports: ReceivedReport[] }>(
    'GET',
    `/ground/messages?astronautId=${encodeURIComponent(astronautId)}`,
  )
export const sendAdvice = (astronautId: string, body: string) =>
  call<GroundMessage>('POST', '/ground/messages', { astronautId, body })
export const fetchFitnessHistory = (astronautId: string) =>
  call<FitnessDecision[]>('GET', `/ground/fitness?astronautId=${encodeURIComponent(astronautId)}`)
export const decideFitness = (astronautId: string, status: FitnessStatus, restrictions: string, medicalNote: string) =>
  call<FitnessDecision>('POST', '/ground/fitness', {
    astronautId,
    status,
    restrictions: restrictions.trim() || null,
    medicalNote: medicalNote.trim() || null,
  })

export interface Inbox {
  delaySeconds: number
  messages: GroundMessage[]
  fitness: FitnessDecision | null
}

export const fetchInbox = () => call<Inbox>('GET', '/inbox')
export const markAdviceRead = (id: string) => call<{ ok: true }>('POST', `/inbox/${encodeURIComponent(id)}/read`)
/** Demo only: deliver everything still in transit (Mars light-time is ~18 min). */
export const fastForwardComms = () => call<{ messages: number; reports: number }>('POST', '/demo/fast-forward')

/** "in 17 min" / "in 40 s" / "now". */
export function arrivesIn(iso: string, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000)
  if (s <= 0) return 'now'
  if (s < 90) return `in ${s} s`
  return `in ${Math.round(s / 60)} min`
}
