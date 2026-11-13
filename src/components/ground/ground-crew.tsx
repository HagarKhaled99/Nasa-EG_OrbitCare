/** /ground: crew overview for the ground team. Surgeon sees report packets; director sees fitness only. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, FileText, Lock, RefreshCw, Satellite } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDelay } from '@/lib/orbit/environments'
import { getMission } from '@/lib/orbit/profiles'
import { FITNESS_LABEL, fetchGroundCrew, type GroundCrewRow } from '@/lib/orbit/api/ground-api'
import { FITNESS_STYLE } from '@/components/orbit/inbox'
import { useGround } from './ground-portal'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

export function GroundCrew() {
  const { isSurgeon } = useGround()
  const [crew, setCrew] = useState<GroundCrewRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setCrew(await fetchGroundCrew())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the crew')
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), 15_000)
    return () => window.clearInterval(timer)
  }, [load])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Crew overview</p>
          <h1 className="mt-1 text-3xl font-semibold">{isSurgeon ? 'Your patients in space' : 'Crew readiness'}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {isSurgeon
              ? 'Open an astronaut to read their report packets and vitals, send advice and decide fitness for duty.'
              : 'Fitness for duty and restrictions for mission planning. Medical details stay between the astronaut and the flight surgeon.'}
          </p>
        </div>
        <Button type="button" variant="outline" className="h-9" onClick={() => void load()}>
          <RefreshCw aria-hidden />
          Refresh
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-status-act/40 bg-status-act/10 p-3 text-sm">
          {error}
        </p>
      )}

      {crew === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading crew…</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {crew?.map((c) => {
            const style = c.fitness ? FITNESS_STYLE[c.fitness.status] : null
            return (
              <li key={c.id}>
                <Link
                  to={`/ground/astronaut/${c.id}`}
                  className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{c.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {c.role} · {getMission(c.missionId).label}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <p
                    className={cn(
                      'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium',
                      style ? style.tone : 'border-dashed border-border text-muted-foreground',
                    )}
                  >
                    {style && <style.icon className="size-4" aria-hidden />}
                    {c.fitness ? FITNESS_LABEL[c.fitness.status] : 'No fitness decision yet'}
                  </p>
                  {c.fitness?.restrictions && <p className="text-sm">Restrictions: {c.fitness.restrictions}</p>}
                  <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                    <dt className="text-muted-foreground">One-way delay</dt>
                    <dd className="font-mono">{formatDelay(c.delaySeconds)}</dd>
                    <dt className="text-muted-foreground">Last data received</dt>
                    <dd className="font-mono">{when(c.lastDataAt)}</dd>
                    {isSurgeon ? (
                      <>
                        <dt className="flex items-center gap-1 text-muted-foreground">
                          <FileText className="size-3" aria-hidden />
                          Report packets
                        </dt>
                        <dd className="font-mono">
                          {c.reportsArrived ?? 0} received
                          {(c.reportsInTransit ?? 0) > 0 && (
                            <span className="ml-1 inline-flex items-center gap-1 text-primary">
                              <Satellite className="size-3" aria-hidden />+{c.reportsInTransit} in transit
                            </span>
                          )}
                        </dd>
                      </>
                    ) : (
                      <>
                        <dt className="flex items-center gap-1 text-muted-foreground">
                          <Lock className="size-3" aria-hidden />
                          Medical data
                        </dt>
                        <dd>Flight surgeon only</dd>
                      </>
                    )}
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
