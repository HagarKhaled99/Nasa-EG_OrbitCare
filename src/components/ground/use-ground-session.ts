/**
 * Ground-team session (Earth portal). Same signed httpOnly cookie as the astronaut app, but only ground
 * accounts are accepted here: the flight surgeon (medical access) and the mission director (readiness only).
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchSession, signInAstronaut, signOutSession } from '@/lib/orbit/api/crew-api'
import type { Session, SignInResult } from '@/lib/orbit/auth/auth-service'

/** Fictional demo users; the server holds the same list (GROUND_STAFF in server/server.mjs). */
export const GROUND_STAFF = [
  {
    id: 'ground-surgeon',
    name: 'Dr. Yasmin Farouk',
    role: 'Flight Surgeon',
    initials: 'YF',
    access: 'medical' as const,
    summary: 'Reads report packets and vitals, sends medical advice, decides fitness for duty.',
  },
  {
    id: 'ground-director',
    name: 'Karim Mansour',
    role: 'Mission Director',
    initials: 'KM',
    access: 'readiness' as const,
    summary: 'Sees fitness for duty and restrictions to plan the mission. No medical data.',
  },
]

export function useGroundSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking')

  const refresh = useCallback(async () => {
    try {
      const s = await fetchSession()
      const ground = s?.kind === 'ground' ? s : null
      setSession(ground)
      setStatus(ground ? 'in' : 'out')
    } catch {
      setSession(null)
      setStatus('out')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    async (id: string, pin: string): Promise<SignInResult> => {
      try {
        const result = await signInAstronaut(id, pin)
        if (result.ok) await refresh()
        return result
      } catch (error) {
        return { ok: false, reason: 'server-unavailable', message: error instanceof Error ? error.message : 'Server error' }
      }
    },
    [refresh],
  )

  const signOut = useCallback(async () => {
    try {
      await signOutSession()
    } finally {
      setSession(null)
      setStatus('out')
    }
  }, [])

  return { session, status, signIn, signOut, isSurgeon: session?.access === 'medical' }
}
