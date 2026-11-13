/**
 * Member 5 (Salma) API client: Action Center + Crew Pulse. Every call acts as the signed-in astronaut
 * (the server takes the identity from the session cookie, never from the request body).
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

// ---------- Action Center ----------

/** One key per alert and day, e.g. "heart-day214-act". Steps ticked for a Watch alert are not reused for Act. */
export const alertKeyFor = (organId: string, missionDay: number, status: string) => `${organId}-day${missionDay}-${status}`
/** Step id used to record "I have read this alert" (plan §7: log acknowledgment). */
export const ACK_STEP = '__ack__'

export interface StepState {
  alert_key: string
  step_id: string
  completed: boolean
  updated_at: string
}

export const fetchActionSteps = () => call<StepState[]>('GET', '/action-steps')
export const saveActionStep = (alertKey: string, stepId: string, completed: boolean) =>
  call<{ ok: true }>('POST', '/action-steps', { alertKey, stepId, completed })

export interface MedicalNotification {
  id: string
  astronaut_id: string
  alert_key: string
  recipient: string
  status: 'queued' | string
  created_at: string
}

export const fetchNotifications = () => call<MedicalNotification[]>('GET', '/medical-notifications')
export const notifyMedicalOfficer = (alertKey: string, recipient: string) =>
  call<MedicalNotification>('POST', '/medical-notifications', { alertKey, recipient })

export interface MedicalReport {
  id: string
  astronaut_id: string
  report: { text: string; [key: string]: unknown }
  status: 'queued' | string
  created_at: string
}

export const fetchReports = () => call<MedicalReport[]>('GET', '/medical-reports')
export const queueReport = (report: MedicalReport['report']) => call<MedicalReport>('POST', '/medical-reports', { report })

// ---------- Crew Pulse ----------

export interface CrewPulseDay {
  missionDay: number
  /** Your own answers today. */
  mine: Array<{ targetId: string; seemsLikeThemselves: boolean }>
  /** Combined answers about you. Never who gave them. */
  aboutMe: { flags: number; total: number }
  /** Who has answered today (participation only). */
  answered: string[]
}

export const fetchCrewPulse = (missionDay: number) => call<CrewPulseDay>('GET', `/crew-pulse?missionDay=${missionDay}`)
export const sendCrewPulseVote = (missionDay: number, targetId: string, seemsLikeThemselves: boolean) =>
  call<{ ok: true }>('POST', '/crew-pulse', { missionDay, targetId, seemsLikeThemselves })
