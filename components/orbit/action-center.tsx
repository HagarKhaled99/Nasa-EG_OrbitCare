'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronRight, Earth, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDelay, isDeepSpace } from '@/lib/orbit/environments'
import { getRouting, type OrganState, type Status } from '@/lib/orbit/health'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { MedicalReportDialog } from './medical-report-dialog'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'
import { StatusPill } from './status-pill'

export function ActionCenter() {
  const { alerts, organs, env } = useOrbit()
  const clear = organs.filter((o) => o.status === 'normal')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Action Center"
        title={alerts.length ? 'What to do, in order of urgency' : 'Nothing needs action today'}
        description={`Steps adapt to where you are. In ${env.name.toLowerCase()} Earth is ${formatDelay(env.delaySeconds)} away (one way).`}
      >
        {alerts.length > 0 && <MedicalReportDialog />}
      </PageHeader>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-status-ok/40 bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-status-ok" aria-hidden />
          <p className="text-lg font-semibold">All body systems are within your normal.</p>
          <p className="text-sm text-muted-foreground">Keep your routine. Your twin is watching for drift.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {alerts.map((alert, i) => (
            <li key={alert.organ.id}>
              <AlertCard alert={alert} rank={i + 1} />
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="distance-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="distance-title" className="text-lg font-semibold">
          Distance-aware decisions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same symptom needs a different response depending on how far you are from Earth.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Level</th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Earth className="size-3.5" aria-hidden /> ISS · Lunar orbit · Moon base
                  </span>
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Rocket className="size-3.5" aria-hidden /> Mars transit · Mars base
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(['normal', 'watch', 'act'] as Status[]).map((s) => {
                const near = getRouting(s, { ...env, delaySeconds: 1 })
                const far = getRouting(s, { ...env, delaySeconds: 1080 })
                const deep = isDeepSpace(env)
                return (
                  <tr key={s} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-3 pr-4 align-top font-normal">
                      <StatusPill status={s} />
                    </th>
                    <td className={cn('py-3 pr-4 align-top', !deep && 'font-medium text-foreground')}>
                      {near.title}
                    </td>
                    <td className={cn('py-3 align-top', deep ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {far.title}
                      {s === 'act' && ' + Medical Report Packet sent to Earth'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {clear.length > 0 && (
        <section aria-labelledby="clear-title">
          <h2 id="clear-title" className="mb-3 text-sm font-medium text-muted-foreground">
            Within your normal
          </h2>
          <ul className="flex flex-wrap gap-2">
            {clear.map((o) => (
              <li key={o.organ.id}>
                <Link
                  href={`/organ/${o.organ.id}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <span aria-hidden className="size-2 rounded-full bg-status-ok" />
                  {o.organ.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function AlertCard({ alert, rank }: { alert: OrganState; rank: number }) {
  const { env } = useOrbit()
  const { organ, status, indicators } = alert
  const routing = getRouting(status, env)
  const style = STATUS_STYLE[status]
  const steps = organ.actions[status]
  const [done, setDone] = useState<string[]>([])
  const reasons = indicators.filter((i) => i.status !== 'normal')

  return (
    <article className={cn('overflow-hidden rounded-2xl border bg-card', style.border)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4', style.soft)}>
        <div className="flex items-center gap-3">
          <span className={cn('flex size-8 items-center justify-center rounded-full font-mono text-sm font-semibold text-background', style.bg)}>
            {rank}
          </span>
          <div>
            <h2 className="font-semibold">{organ.name}</h2>
            <p className="text-sm text-muted-foreground">
              {reasons.map((r) => `${r.meta.label}: ${r.message}`).join(' · ')}
            </p>
          </div>
        </div>
        <StatusPill status={status} size="lg" />
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Who handles it</p>
          <p className="mt-1 font-semibold">{routing.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{routing.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/organ/${organ.id}`} />}>
              Open organ panel
              <ChevronRight aria-hidden />
            </Button>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Steps ({done.length}/{steps.length} done)
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {steps.map((step) => {
              const checked = done.includes(step)
              return (
                <li key={step}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed transition-colors hover:bg-secondary',
                      checked && 'border-status-ok/40 bg-status-ok/10 text-muted-foreground line-through',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDone((prev) => (checked ? prev.filter((s) => s !== step) : [...prev, step]))
                      }
                      className="mt-0.5 size-4 shrink-0 accent-[var(--status-ok)]"
                    />
                    {step}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </article>
  )
}
