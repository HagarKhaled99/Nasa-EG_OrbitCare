/**
 * Client for the crew database API (server/server.mjs). All calls go to `/api/...`, which Vite proxies
 * to http://localhost:4000 in development.
 */
import type { CrewProfile, NewCrewProfile } from '../profiles'
import type { Session } from '../auth/auth-service'

const BASE = '/api'
const TIMEOUT_MS = 6000

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: string[] = [],
  ) {
    super(message)
  }
}

/** The server could not be reached at all (not started, or the network is down). */
export class ApiUnavailableError extends Error {
  constructor() {
    super('The crew database server is not reachable. Start it with “npm run dev”.')
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new ApiUnavailableError()
  } finally {
    clearTimeout(timer)
  }
  // Vite's proxy answers 500/502/504 with an empty or HTML body when the API process is not running.
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new ApiUnavailableError()
    }
  } else if (res.status >= 500) {
    throw new ApiUnavailableError()
  }
  return { status: res.status, data: data as T }
}

function fail(status: number, data: unknown): never {
  const body = (data ?? {}) as { error?: string; errors?: string[] }
  throw new ApiError(status, body.error ?? `Request failed (${status})`, body.errors ?? [])
}

export async function fetchAstronauts(): Promise<CrewProfile[]> {
  const { status, data } = await request<CrewProfile[]>('GET', '/astronauts')
  if (status !== 200 || !Array.isArray(data)) fail(status, data)
  return data
}

/** Sign-up. The server also signs the new astronaut in (session cookie) and returns the session. */
export async function createAstronaut(input: NewCrewProfile): Promise<CrewProfile & { session: Session }> {
  const { status, data } = await request<CrewProfile & { session: Session }>('POST', '/astronauts', input)
  if (status !== 201) fail(status, data)
  return data
}

export type ServerSignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: 'wrong-pin'; attemptsLeft: number }
  | { ok: false; reason: 'locked'; lockedUntil: number }

export async function signInAstronaut(astronautId: string, pin: string): Promise<ServerSignInResult> {
  const { status, data } = await request<ServerSignInResult>('POST', '/auth/sign-in', { astronautId, pin })
  if (status === 200 || status === 401 || status === 423) return data
  fail(status, data)
}

/** Who is signed in on this tablet (from the httpOnly cookie), or null. */
export async function fetchSession(): Promise<Session | null> {
  const { status, data } = await request<{ session?: Session }>('GET', '/auth/session')
  if (status === 401) return null
  if (status !== 200 || !data?.session) fail(status, data)
  return data.session
}

export async function signOutSession(): Promise<void> {
  await request<unknown>('POST', '/auth/sign-out')
}

/** Forgotten PIN: set a new one with the admin PIN (crew medical officer). Also lifts a lockout. */
export async function resetAstronautPin(astronautId: string, adminPin: string, newPin: string): Promise<void> {
  const { status, data } = await request<unknown>('POST', `/astronauts/${encodeURIComponent(astronautId)}/reset-pin`, {
    adminPin,
    newPin,
  })
  if (status !== 204) fail(status, data)
}

export async function deleteAstronaut(astronautId: string, pin: string): Promise<void> {
  const { status, data } = await request<unknown>('DELETE', `/astronauts/${encodeURIComponent(astronautId)}`, { pin })
  if (status !== 204) fail(status, data)
}
