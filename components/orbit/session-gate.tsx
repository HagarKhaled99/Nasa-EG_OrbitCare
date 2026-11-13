'use client'

/**
 * Session gate (Member 2). Wraps every page. /login and /signup pass straight
 * through (opening /login signs the previous person out).
 *
 * It asks the server who is signed in (GET /api/auth/session):
 *  - nobody → go to /login
 *  - someone → load THAT person's twin and their mission's environment
 * The page only renders once the twin belongs to the signed-in account, so
 * nobody ever sees another person's data, not even for a moment.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Orbit } from 'lucide-react'
import { astronautFromProfile, type AccountProfile } from '@/lib/orbit/accounts'
import { registerAstronaut } from '@/lib/orbit/crew'
import { useOrbit } from './orbit-provider'

const PUBLIC_PATHS = ['/login', '/signup']

interface SessionValue {
  profile: AccountProfile
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

/** The signed-in account. Only use inside pages wrapped by <SessionGate>. */
export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionGate')
  return ctx
}

/** Load an account's twin into the shared state. */
export function useApplyProfile() {
  const { setAstronautId, setEnvironmentId } = useOrbit()
  return useCallback(
    (profile: AccountProfile, withEnvironment = true) => {
      registerAstronaut(astronautFromProfile(profile))
      setAstronautId(profile.id)
      if (withEnvironment) setEnvironmentId(profile.environmentId)
    },
    [setAstronautId, setEnvironmentId],
  )
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { astronaut } = useOrbit()
  const applyProfile = useApplyProfile()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [status, setStatus] = useState<'checking' | 'in' | 'out'>('checking')
  const environmentApplied = useRef<string | null>(null)
  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    if (isPublic) {
      setStatus('checking')
      setProfile(null)
      environmentApplied.current = null
      // Opening /login ends the previous person's session, so the tablet can be handed over.
      if (pathname === '/login') fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
      return
    }
    let cancelled = false
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          setStatus('out')
          router.replace('/login')
          return
        }
        const data = (await res.json()) as { profile: AccountProfile }
        // Set the environment only once per sign-in, so a manual switch sticks.
        const firstLoad = environmentApplied.current !== data.profile.id
        applyProfile(data.profile, firstLoad)
        environmentApplied.current = data.profile.id
        setProfile(data.profile)
        setStatus('in')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('out')
        router.replace('/login')
      })
    return () => {
      cancelled = true
    }
  }, [isPublic, pathname, router, applyProfile])

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    environmentApplied.current = null
    setProfile(null)
    setStatus('out')
    router.replace('/login')
  }, [router])

  if (isPublic) return <>{children}</>

  const ready = status === 'in' && profile !== null && astronaut.id === profile.id
  if (!ready) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-center" role="status">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Orbit className="size-6 animate-spin [animation-duration:2.4s]" aria-hidden />
        </span>
        <p className="font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
          {status === 'out' ? 'Opening sign in' : 'Checking your sign-in'}
        </p>
      </div>
    )
  }

  return <SessionContext.Provider value={{ profile, signOut }}>{children}</SessionContext.Provider>
}
