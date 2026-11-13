
import { LogOut, Radio } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { ENVIRONMENTS, formatDelay, type EnvironmentId } from '@/lib/orbit/environments'
import { useOrbit } from './orbit-provider'
import { ReadinessRing } from './readiness-ring'

const selectClass =
  'h-10 rounded-lg border border-input bg-secondary px-3 text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function TopBar() {
  const { astronaut, env, readiness, setEnvironmentId, signOut } = useOrbit()
  const navigate = useNavigate()

  return (
    <header className="z-30 border-b lg:sticky lg:top-0 border-border bg-background/85 px-4 py-3 backdrop-blur md:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
            {astronaut.initials}
          </span>
          <div className="min-w-0">
            {/* Locked to the signed-in account (Member 2). To change person, sign out and sign in again. */}
            <p className="truncate text-base font-semibold">{astronaut.name}</p>
            <p className="text-xs text-muted-foreground">{astronaut.role}</p>
          </div>
        </div>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Mission day</dt>
            <dd className="font-mono text-base font-semibold">{MISSION_DAY}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              <label htmlFor="env-select">Environment</label>
            </dt>
            <dd>
              <select
                id="env-select"
                value={env.id}
                onChange={(e) => setEnvironmentId(e.target.value as EnvironmentId)}
                className={selectClass}
              >
                {ENVIRONMENTS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Earth delay (one way)</dt>
            <dd className="flex items-center gap-1.5 font-mono text-base font-semibold">
              <Radio className="size-4 text-primary" aria-hidden />
              {formatDelay(env.delaySeconds)}
            </dd>
          </div>
        </dl>

        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Readiness</p>
            <p className="text-xs font-medium">Mission score</p>
          </div>
          <ReadinessRing value={readiness} size={52} />
          {/* The sidebar (with Sign out) is hidden on phones and small tablets. */}
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/login'))}
            aria-label="Sign out"
            className="flex size-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
          >
            <LogOut className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  )
}
