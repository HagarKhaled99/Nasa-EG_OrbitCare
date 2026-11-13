import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Database, KeyRound, Loader2, Lock, RefreshCw, Trash2, UserPlus, Watch } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CREW } from '@/lib/orbit/crew'
import { PIN_LENGTH } from '@/lib/orbit/auth/auth-service'
import { ApiError, resetAstronautPin } from '@/lib/orbit/api/crew-api'
import { getMission, initialsFor, type CrewProfile } from '@/lib/orbit/profiles'
import { AuthSplit } from './auth-split'
import { useOrbit } from './orbit-provider'

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** /manage-crew: list everyone in the crew database and remove profiles (needs their PIN or the admin PIN). */
export function ManageCrew() {
  const { profiles, crewDbStatus, refreshCrew } = useOrbit()
  const [refreshing, setRefreshing] = useState(false)

  const refresh = async () => {
    setRefreshing(true)
    await refreshCrew()
    setRefreshing(false)
  }

  return (
    <AuthSplit>
      <section aria-labelledby="manage-title" className="flex flex-col gap-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>

        <div>
          <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
            <Database className="size-3.5" aria-hidden />
            Crew database
          </p>
          <h1 id="manage-title" className="mt-2 text-3xl font-semibold">
            Manage crew
          </h1>
          <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
            Everyone who signed up is stored here. Removing a profile deletes the astronaut and their baseline from the
            database for good. You need that astronaut&apos;s PIN, or the admin PIN held by the crew medical officer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium',
              crewDbStatus === 'online' && 'border-status-ok/40 bg-status-ok/10 text-status-ok',
              crewDbStatus === 'offline' && 'border-status-act/40 bg-status-act/10 text-status-act',
              crewDbStatus === 'loading' && 'border-border bg-muted text-muted-foreground',
            )}
          >
            <span className="size-2 rounded-full bg-current" aria-hidden />
            {crewDbStatus === 'online'
              ? `Connected · ${profiles.length} ${profiles.length === 1 ? 'astronaut' : 'astronauts'}`
              : crewDbStatus === 'offline'
                ? 'Database not reachable'
                : 'Connecting…'}
          </span>
          <Button type="button" variant="outline" className="h-9" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden />
            Refresh
          </Button>
          <ButtonLink to="/signup" variant="ghost" className="h-9">
            <UserPlus aria-hidden />
            Add astronaut
          </ButtonLink>
        </div>

        {crewDbStatus === 'offline' && (
          <p className="rounded-xl border border-status-act/40 bg-status-act/10 p-4 text-sm leading-relaxed">
            The crew database server is not running. Stop the dev server and start it again with{' '}
            <code className="font-mono">npm run dev</code> (not <code className="font-mono">npx vite</code>). That
            starts the website and the database together.
          </p>
        )}

        {crewDbStatus === 'online' && profiles.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No astronauts in the database yet.{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up the first one
            </Link>
            .
          </div>
        )}

        {profiles.length > 0 && (
          <ul className="flex flex-col gap-3">
            {profiles.map((p) => (
              <CrewRow key={p.id} profile={p} />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            Built-in sample crew
          </h2>
          <ul className="flex flex-col gap-2">
            {CREW.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                  {c.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground"> · {c.role}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" aria-hidden />
                  Built-in
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The four sample crew are part of the app code, not the database. The judge demo depends on them, so they
            cannot be removed here.
          </p>
        </div>
      </section>
    </AuthSplit>
  )
}

function CrewRow({ profile }: { profile: CrewProfile }) {
  const { removeCrewMember } = useOrbit()
  const [confirming, setConfirming] = useState(false)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const first = profile.name.split(' ')[0]
  const b = profile.baseline
  const pinId = `remove-pin-${profile.id}`
  const [resetting, setResetting] = useState(false)
  const [adminPin, setAdminPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, PIN_LENGTH)

  const closeReset = () => {
    setResetting(false)
    setAdminPin('')
    setNewPin('')
    setNewPin2('')
    setError(null)
  }

  /** Forgotten PIN: the crew medical officer sets a new one with the admin PIN (also lifts a lockout). */
  const reset = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (newPin !== newPin2) return setError('The two new PINs do not match.')
    setBusy(true)
    setError(null)
    try {
      await resetAstronautPin(profile.id, adminPin, newPin)
      closeReset()
      setDone(`${first}’s PIN was changed. Sign in with the new PIN.`)
    } catch (e) {
      setAdminPin('')
      setError(
        e instanceof ApiError && e.status === 403
          ? 'Admin PIN not accepted.'
          : e instanceof Error
            ? e.message
            : 'Could not change the PIN.',
      )
    } finally {
      setBusy(false)
    }
  }

  const remove = async (event: React.FormEvent) => {
    event.preventDefault()
    if (pin.length !== PIN_LENGTH || busy) return
    setBusy(true)
    setError(null)
    try {
      await removeCrewMember(profile.id, pin)
      // Row disappears: the provider drops it from the list.
    } catch (e) {
      setBusy(false)
      setPin('')
      setError(
        e instanceof ApiError && e.status === 403
          ? 'PIN not accepted. Use this astronaut’s own PIN or the admin PIN.'
          : e instanceof Error
            ? e.message
            : 'Could not remove this astronaut.',
      )
    }
  }

  return (
    <li
      className={cn(
        'rounded-2xl border bg-card p-4',
        confirming ? 'border-status-act/50' : resetting ? 'border-primary/50' : 'border-border',
      )}
    >
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
          {initialsFor(profile.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{profile.name}</p>
          <p className="text-sm text-muted-foreground">
            {profile.role} · {getMission(profile.missionId).label}
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
            <span>HR {b.heartRate} bpm</span>
            <span>SpO₂ {b.spo2}%</span>
            <span>
              BP {b.systolic}/{b.diastolic}
            </span>
            <span>{b.temperature} °C</span>
            <span>sleep {b.sleep} h</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
            <span>Added {formatDate(profile.createdAt)}</span>
            {profile.devices.watch ? (
              <span className="inline-flex items-center gap-1">
                <Watch className="size-3" aria-hidden />
                {profile.devices.watch}
              </span>
            ) : (
              <span>No watch paired</span>
            )}
          </p>
        </div>
        {!confirming && !resetting && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => {
                setDone(null)
                setResetting(true)
              }}
              aria-label={`Reset PIN for ${profile.name}`}
            >
              <KeyRound aria-hidden />
              <span className="hidden sm:inline">Reset PIN</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 text-status-act hover:bg-status-act/10 hover:text-status-act"
              onClick={() => {
                setDone(null)
                setConfirming(true)
              }}
              aria-label={`Remove ${profile.name}`}
            >
              <Trash2 aria-hidden />
              <span className="hidden sm:inline">Remove</span>
            </Button>
          </div>
        )}
      </div>

      {done && (
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-status-ok">
          <Check className="size-4" aria-hidden />
          {done}
        </p>
      )}

      {resetting && (
        <form onSubmit={(e) => void reset(e)} className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm">
            Forgot {first}&apos;s PIN? Nobody can read a stored PIN, so the crew medical officer sets a new one with the
            admin PIN. This also lifts a lockout.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['Admin PIN', adminPin, setAdminPin, 'off'],
                [`New PIN for ${first}`, newPin, setNewPin, 'new-password'],
                ['Repeat new PIN', newPin2, setNewPin2, 'new-password'],
              ] as const
            ).map(([label, value, set, autoComplete], i) => (
              <label key={label} className="flex flex-col gap-1 text-xs font-medium">
                {label}
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete={autoComplete}
                  autoFocus={i === 0}
                  maxLength={PIN_LENGTH}
                  value={value}
                  onChange={(e) => set(digits(e.target.value))}
                  className="h-10 w-28 rounded-lg border border-input bg-background px-3 font-mono tracking-[0.5em] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              className="h-10"
              disabled={busy || [adminPin, newPin, newPin2].some((p) => p.length !== PIN_LENGTH)}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              Set new PIN
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={closeReset}>
              Cancel
            </Button>
          </div>
          {error && (
            <p className="text-sm text-status-act" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {confirming && (
        <form onSubmit={(e) => void remove(e)} className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <label htmlFor={pinId} className="text-sm">
            Remove <span className="font-medium">{profile.name}</span> permanently? Enter {first}&apos;s PIN or the
            admin PIN.
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={pinId}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
              className="h-10 w-32 rounded-lg border border-input bg-background px-3 font-mono tracking-[0.5em] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-invalid={!!error}
            />
            <Button
              type="submit"
              className="h-10 bg-status-act text-white hover:bg-status-act/85"
              disabled={pin.length !== PIN_LENGTH || busy}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
              Remove permanently
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10"
              onClick={() => {
                setConfirming(false)
                setPin('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
          {error && (
            <p className="text-sm text-status-act" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </li>
  )
}
