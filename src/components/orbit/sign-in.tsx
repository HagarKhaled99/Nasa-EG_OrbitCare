import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Clock, Database, Delete, Loader2, Lock, PenLine, RefreshCw, Search, Settings2, Watch, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MISSION_DAY, MISSION_NAME } from '@/lib/orbit/crew'
import {
  DEMO_PIN,
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  PIN_LENGTH,
  formatAgo,
  getAttemptState,
  recentSignIns,
} from '@/lib/orbit/auth/auth-service'
import { isSampleCrew } from '@/lib/orbit/profiles'
import { AuthSplit, AuthTabs } from './auth-split'
import { useOrbit } from './orbit-provider'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const
type Key = (typeof KEYS)[number]

type Feedback =
  | { kind: 'none' }
  | { kind: 'wrong'; attemptsLeft: number }
  | { kind: 'locked'; until: number }
  | { kind: 'error'; message: string }

export function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/'
  const { crew, profiles, signIn, crewDbStatus, refreshCrew } = useOrbit()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'none' })
  const [shakeKey, setShakeKey] = useState(0)
  const [query, setQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const selected = crew.find((member) => member.id === selectedId) ?? null
  const firstName = selected?.name.split(' ')[0]
  const locked = feedback.kind === 'locked' && feedback.until > now
  const secondsLeft = feedback.kind === 'locked' ? Math.max(0, Math.ceil((feedback.until - now) / 1000)) : 0

  // Tick once a second while locked so the countdown updates and the pad unlocks by itself.
  useEffect(() => {
    if (feedback.kind !== 'locked') return
    const timer = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= feedback.until) setFeedback({ kind: 'none' })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [feedback])

  const choose = (id: string) => {
    const state = getAttemptState(id)
    setSelectedId(id)
    setPin('')
    setNow(Date.now())
    setFeedback(state.lockedUntil ? { kind: 'locked', until: state.lockedUntil } : { kind: 'none' })
  }

  const press = useCallback(
    (key: Key) => {
      if (!selected || locked || checking) return
      if (key === 'clear') return setPin('')
      if (key === 'back') return setPin((current) => current.slice(0, -1))

      const next = (pin + key).slice(0, PIN_LENGTH)
      setPin(next)
      if (next.length < PIN_LENGTH) return

      setChecking(true)
      void signIn(selected.id, next).then((result) => {
        setChecking(false)
        if (result.ok) {
          navigate(returnTo, { replace: true })
          return
        }
        setPin('')
        setNow(Date.now())
        if (result.reason === 'server-unavailable') {
          setFeedback({ kind: 'error', message: result.message })
          return
        }
        setShakeKey((k) => k + 1)
        if (result.reason === 'locked') setFeedback({ kind: 'locked', until: result.lockedUntil })
        else if (result.reason === 'wrong-pin') setFeedback({ kind: 'wrong', attemptsLeft: result.attemptsLeft })
      })
    },
    [selected, locked, checking, pin, signIn, navigate, returnTo],
  )

  // Physical keyboard support on the PIN screen (digits, Backspace, Escape).
  useEffect(() => {
    if (!selected) return
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return
      if (/^\d$/.test(event.key)) press(event.key as Key)
      else if (event.key === 'Backspace') press('back')
      else if (event.key === 'Escape') setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, press])

  // Search by name or role, ignoring case and extra spaces.
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
  const results = q
    ? crew.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q))
    : crew

  // Recently signed-in crew first (max 3), everyone else under "All crew".
  const recent = recentSignIns()
    .map((r) => ({ member: crew.find((c) => c.id === r.astronautId), at: r.at }))
    .filter((r): r is { member: (typeof crew)[number]; at: number } => Boolean(r.member))
    .slice(0, 3)
  const recentIds = new Set(recent.map((r) => r.member.id))
  const others = crew.filter((c) => !recentIds.has(c.id))

  const memberCard = (member: (typeof crew)[number], recentAt?: number, highlight = false) => {
    const profile = profiles.find((p) => p.id === member.id)
    const watchPaired = profile ? Boolean(profile.devices.watch) : true
    const memberLocked = Boolean(getAttemptState(member.id).lockedUntil)
    return (
      <li key={member.id}>
        <button
          type="button"
          onClick={() => choose(member.id)}
          className={cn(
            'flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            highlight ? 'border-primary/50 shadow-sm ring-1 ring-primary/20' : 'border-border',
          )}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
            {member.initials}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{member.name}</span>
            <span className="truncate text-sm text-muted-foreground">
              {member.role} ·{' '}
              {recentAt !== undefined ? `signed in ${formatAgo(recentAt)}` : `last check-in ${member.lastCheckIn}`}
            </span>
          </span>
          {memberLocked ? (
            <span className="hidden items-center gap-1 rounded-full border border-status-act/40 bg-status-act/10 px-2 py-0.5 text-xs font-medium text-status-act sm:inline-flex">
              <Lock className="size-3" aria-hidden />
              Locked
            </span>
          ) : watchPaired ? (
            <span className="hidden items-center gap-1 rounded-full border border-status-ok/40 bg-status-ok/10 px-2 py-0.5 text-xs font-medium text-status-ok sm:inline-flex">
              <Watch className="size-3" aria-hidden />
              Watch synced
            </span>
          ) : (
            <span className="hidden items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
              <PenLine className="size-3" aria-hidden />
              Manual entry
            </span>
          )}
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </li>
    )
  }

  if (!selected) {
    return (
      <AuthSplit>
        <section aria-labelledby="signin-title" className="flex flex-col gap-6">
          <AuthTabs active="signin" />
          <div>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
              Sign in · {MISSION_NAME} · Day {MISSION_DAY}
            </p>
            <h1 id="signin-title" className="mt-2 text-3xl font-semibold text-balance md:text-4xl">
              Who&apos;s checking in?
            </h1>
            <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">
              Each twin knows one person&apos;s normal. Choose your profile, then enter your PIN.
            </p>
          </div>

          <div className="relative">
            <label htmlFor="crew-search" className="sr-only">
              Search crew by name or role
            </label>
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="crew-search"
              type="search"
              autoComplete="off"
              placeholder="Search your name or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results.length === 1) choose(results[0].id)
              }}
              className="h-12 w-full rounded-2xl border border-border bg-card pr-12 pl-12 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <p className="sr-only" role="status">
            {q ? `${results.length} crew ${results.length === 1 ? 'member' : 'members'} found` : ''}
          </p>

          {results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No crew member matches “{query.trim()}”.{' '}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Create a new profile
              </Link>
            </div>
          )}

          {q ? (
            <ul className="flex flex-col gap-3">{results.map((m) => memberCard(m))}</ul>
          ) : (
            <>
              {recent.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
                    <Clock className="size-3.5" aria-hidden />
                    Recent
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {recent.map((r, i) => memberCard(r.member, r.at, i === 0))}
                  </ul>
                </div>
              )}
              {others.length > 0 && (
                <div className="flex flex-col gap-3">
                  {recent.length > 0 && (
                    <h2 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">All crew</h2>
                  )}
                  <ul className="flex flex-col gap-3">{others.map((m) => memberCard(m))}</ul>
                </div>
              )}
            </>
          )}

          {crewDbStatus === 'offline' && (
            <div
              role="status"
              className="flex flex-wrap items-center gap-3 rounded-xl border border-status-watch/40 bg-status-watch/10 p-4 text-sm"
            >
              <Database className="size-4 shrink-0 text-status-watch" aria-hidden />
              <p className="min-w-0 flex-1">
                Crew database not reachable, so only the sample crew are shown. Start it with{' '}
                <code className="font-mono">npm run dev</code>.
              </p>
              <button
                type="button"
                onClick={() => void refreshCrew()}
                className="inline-flex items-center gap-1 rounded-md font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Retry
              </button>
            </div>
          )}

          <Link
            to="/manage-crew"
            className="inline-flex items-center gap-2 self-start rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Settings2 className="size-4" aria-hidden />
            Manage crew database
          </Link>

          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Runs on this tablet with no internet. New crew are saved in the local crew database; a daily summary is
              queued for flight surgeons.
            </p>
            <p className="mt-3 font-mono text-xs tracking-wide">
              Demo · simulated data · PIN for the four sample crew: {DEMO_PIN}
            </p>
          </div>
        </section>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit>
      <section aria-labelledby="pin-title" className="flex flex-col items-center gap-6 text-center">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Not {firstName}? Switch
        </button>
        <span className="flex size-20 items-center justify-center rounded-full bg-primary/15 font-mono text-2xl font-semibold text-primary">
          {selected.initials}
        </span>
        <div>
          <h1 id="pin-title" className="text-3xl font-semibold">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {selected.role} · Enter your {PIN_LENGTH}-digit PIN
          </p>
        </div>

        <div
          key={shakeKey}
          className={cn('flex gap-4', shakeKey > 0 && 'orbit-shake')}
          role="status"
          aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
        >
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-4 rounded-full border-2 transition-colors',
                feedback.kind === 'wrong' && pin.length === 0 ? 'border-status-act' : 'border-primary',
                i < pin.length ? 'bg-primary' : 'bg-transparent',
              )}
              aria-hidden
            />
          ))}
        </div>

        <div className="min-h-10" aria-live="assertive">
          {checking && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Checking PIN…
            </p>
          )}
          {feedback.kind === 'error' && (
            <p className="flex items-center gap-2 text-sm text-status-act">
              <Database className="size-4 shrink-0" aria-hidden />
              {feedback.message}
            </p>
          )}
          {feedback.kind === 'wrong' && (
            <p className="text-sm text-status-act">
              That PIN does not match. {feedback.attemptsLeft} {feedback.attemptsLeft === 1 ? 'try' : 'tries'} left
              before a {LOCKOUT_MS / 1000}-second lock.
            </p>
          )}
          {locked && (
            <p className="flex items-center gap-2 text-sm text-status-act">
              <Lock className="size-4" aria-hidden />
              Locked after {MAX_ATTEMPTS} wrong tries. Try again in {secondsLeft} s, or ask the crew medical officer.
            </p>
          )}
        </div>

        <div className="grid w-full max-w-xs grid-cols-3 gap-3">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              disabled={locked || checking}
              onClick={() => press(key)}
              aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear PIN' : key}
              className={cn(
                'flex h-16 items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-primary/15 disabled:opacity-40',
                key === 'clear' || key === 'back'
                  ? 'text-sm font-medium text-muted-foreground'
                  : 'font-mono text-2xl font-semibold',
              )}
            >
              {key === 'back' ? <Delete className="size-5" aria-hidden /> : key === 'clear' ? 'Clear' : key}
            </button>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">
          {isSampleCrew(selected.id)
            ? `Sample crew · demo PIN ${DEMO_PIN}`
            : 'Use the PIN you chose when you created this profile.'}
        </p>
      </section>
    </AuthSplit>
  )
}
