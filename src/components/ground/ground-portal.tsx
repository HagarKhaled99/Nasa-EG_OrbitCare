/**
 * Ground portal (Earth): /ground/*. Second portal next to the astronaut app.
 *   /ground/login          ground-team sign-in (flight surgeon, mission director)
 *   /ground                crew overview
 *   /ground/astronaut/:id  one astronaut (surgeon: medical file + advice + fitness; director: fitness only)
 */
import { createContext, useContext, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowLeft, Delete, FastForward, Globe2, Loader2, LogOut, Stethoscope, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEMO_PIN, PIN_LENGTH } from '@/lib/orbit/auth/auth-service'
import { fastForwardComms } from '@/lib/orbit/api/ground-api'
import { AuthSplit } from '@/components/orbit/auth-split'
import { GROUND_STAFF, useGroundSession } from './use-ground-session'
import { GroundCrew } from './ground-crew'
import { GroundAstronaut } from './ground-astronaut'

type GroundCtx = ReturnType<typeof useGroundSession>
const GroundContext = createContext<GroundCtx | null>(null)

export function useGround() {
  const ctx = useContext(GroundContext)
  if (!ctx) throw new Error('useGround must be used inside GroundPortal')
  return ctx
}

export function GroundPortal() {
  const ground = useGroundSession()
  return (
    <GroundContext.Provider value={ground}>
      <Routes>
        <Route path="login" element={<GroundLogin />} />
        <Route path="*" element={<GroundProtected />} />
      </Routes>
    </GroundContext.Provider>
  )
}

function GroundProtected() {
  const { status } = useGround()
  if (status === 'checking') {
    return (
      <p role="status" className="p-8 text-center font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
        Checking your sign-in…
      </p>
    )
  }
  if (status === 'out') return <Navigate to="/ground/login" replace />
  return (
    <GroundShell>
      <Routes>
        <Route index element={<GroundCrew />} />
        <Route path="astronaut/:astronautId" element={<GroundAstronaut />} />
        <Route path="*" element={<Navigate to="/ground" replace />} />
      </Routes>
    </GroundShell>
  )
}

function GroundShell({ children }: { children: React.ReactNode }) {
  const { session, signOut, isSurgeon } = useGround()
  const navigate = useNavigate()
  const [ff, setFf] = useState<string | null>(null)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 md:px-6">
          <Link to="/ground" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Globe2 className="size-5" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-mono text-sm font-semibold tracking-[0.2em]">ORBIT TWIN</span>
              <span className="text-xs text-muted-foreground">Ground portal · Earth</span>
            </span>
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold">{session?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.role}</p>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                isSurgeon ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground',
              )}
            >
              {isSurgeon ? <Stethoscope className="size-3.5" aria-hidden /> : <Briefcase className="size-3.5" aria-hidden />}
              {isSurgeon ? 'Medical access' : 'Readiness only · no medical data'}
            </span>
            <Button
              type="button"
              variant="outline"
              className="h-9 border-dashed"
              title="Demo only: deliver everything still crossing space"
              onClick={async () => {
                try {
                  const r = await fastForwardComms()
                  setFf(`Delivered ${r.messages} message(s) and ${r.reports} report(s).`)
                } catch {
                  setFf('Crew server not reachable.')
                }
                window.setTimeout(() => setFf(null), 4000)
              }}
            >
              <FastForward aria-hidden />
              Demo: skip light delay
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              onClick={() => void signOut().then(() => navigate('/ground/login'))}
            >
              <LogOut aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
        {ff && (
          <p role="status" className="bg-secondary px-4 py-1.5 text-center text-xs">
            {ff} Refresh the page you are on to see them.
          </p>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

function GroundLogin() {
  const { signIn, status } = useGround()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<(typeof GROUND_STAFF)[number] | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'in') return <Navigate to="/ground" replace />

  const press = async (key: (typeof KEYS)[number]) => {
    if (!selected || busy) return
    if (key === 'clear') return setPin('')
    if (key === 'back') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, PIN_LENGTH)
    setPin(next)
    setError(null)
    if (next.length < PIN_LENGTH) return
    setBusy(true)
    const result = await signIn(selected.id, next)
    setBusy(false)
    setPin('')
    if (result.ok) navigate('/ground')
    else if (result.reason === 'wrong-pin') setError(`Wrong PIN. ${result.attemptsLeft} tries left.`)
    else if (result.reason === 'locked') setError('Locked after 5 wrong tries. Wait a minute.')
    else if (result.reason === 'server-unavailable') setError(result.message)
  }

  return (
    <AuthSplit>
      <section aria-labelledby="ground-title" className="flex flex-col gap-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Crew sign-in (on board)
        </Link>
        <div>
          <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">Ground portal · Earth</p>
          <h1 id="ground-title" className="mt-2 text-3xl font-semibold">
            Ground team sign-in
          </h1>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            For the medical team and mission management on Earth. Every message to the crew crosses space with the
            light-time delay; onboard emergencies are handled on board first.
          </p>
        </div>

        {!selected ? (
          <ul className="flex flex-col gap-3">
            {GROUND_STAFF.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => setSelected(g)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                    {g.initials}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {g.name} · {g.role}
                    </span>
                    <span className="block text-sm text-muted-foreground">{g.summary}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-5 text-center">
            <button
              type="button"
              onClick={() => {
                setSelected(null)
                setPin('')
                setError(null)
              }}
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Not {selected.name.split(' ').slice(-2)[0]}? Switch
            </button>
            <p className="text-xl font-semibold">
              {selected.name} · {selected.role}
            </p>
            <div className="flex gap-4" role="status" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
              {Array.from({ length: PIN_LENGTH }, (_, i) => (
                <span key={i} aria-hidden className={cn('size-4 rounded-full border-2 border-primary', i < pin.length && 'bg-primary')} />
              ))}
            </div>
            <p className="min-h-5 text-sm text-status-act" aria-live="assertive">
              {busy ? <Loader2 className="inline size-4 animate-spin" aria-hidden /> : error}
            </p>
            <div className="grid w-full max-w-xs grid-cols-3 gap-3">
              {KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => void press(key)}
                  aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear PIN' : key}
                  className={cn(
                    'flex h-14 items-center justify-center rounded-2xl border border-border bg-card hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40',
                    key === 'clear' || key === 'back' ? 'text-sm text-muted-foreground' : 'font-mono text-2xl font-semibold',
                  )}
                >
                  {key === 'back' ? <Delete className="size-5" aria-hidden /> : key === 'clear' ? 'Clear' : key}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="rounded-xl border border-border bg-secondary/40 p-4 font-mono text-xs text-muted-foreground">
          Demo · fictional ground team · PIN {DEMO_PIN}
        </p>
      </section>
    </AuthSplit>
  )
}
