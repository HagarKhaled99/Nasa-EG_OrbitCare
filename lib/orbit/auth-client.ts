/**
 * Account functions for the sign-in and sign-up pages (Member 1 calls these).
 *
 * Member 2 owns what happens after: the server checks the PIN, sets a private
 * session cookie, and every page then shows ONLY the signed-in person's twin.
 * Nobody can open someone else's account.
 *
 * Sign in (in sign-in.tsx, when 4 digits are entered):
 *
 *   const result = await signIn(selected.id, pin)
 *   if (result.ok) router.push('/')
 *   else showError(result.error)          // "Wrong PIN. 4 tries left." / locked
 *
 * Sign up (in sign-up.tsx, on "Finish"):
 *
 *   const result = await signUp({ name, role, figure, mission, pin })
 *   if (result.ok) router.push('/')       // the new person's twin opens
 *   else showError(result.error)
 *
 * Crew list for the sign-in screen (includes people who signed up):
 *
 *   const crew = await fetchCrew()
 *
 * Opening /login signs the previous person out automatically, so the tablet
 * can be handed over safely.
 */
import type { AccountProfile } from './accounts'

export type AuthResult = { ok: true; profile: AccountProfile } | { ok: false; error: string; locked?: boolean }

async function post(url: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as { profile?: AccountProfile; error?: string }
    if (res.ok && data.profile) return { ok: true, profile: data.profile }
    return { ok: false, error: data.error ?? 'Something went wrong. Try again.', locked: res.status === 423 }
  } catch {
    return { ok: false, error: 'Could not reach the twin. Check the tablet and try again.' }
  }
}

/** Check the PIN on the server and start this person's session. */
export function signIn(astronautId: string, pin: string) {
  return post('/api/auth/login', { astronautId, pin })
}

export interface SignUpData {
  name: string
  role: string
  figure: 'female' | 'male'
  /** One of MISSIONS[].label from lib/orbit/accounts.ts */
  mission: string
  pin: string
}

/** Create a new account (PIN is hashed on the server) and sign it in. */
export function signUp(data: SignUpData) {
  return post('/api/auth/signup', data)
}

/** End the session on this tablet. */
export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
}

export interface CrewCard {
  id: string
  name: string
  role: string
  initials: string
  figure: 'female' | 'male'
  lastCheckIn: string
}

/** Everyone who can sign in on this tablet (no PINs). Empty list if offline. */
export async function fetchCrew(): Promise<CrewCard[]> {
  try {
    const res = await fetch('/api/auth/crew', { cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as { crew?: CrewCard[] }
    return data.crew ?? []
  } catch {
    return []
  }
}
