'use client'

import Link from 'next/link'
import { ArrowLeft, Briefcase, Hourglass, ShieldAlert, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getRouting, type IndicatorState } from '@/lib/orbit/health'
import type { OrganId } from '@/lib/orbit/organs'
import { STATUS_STYLE, formatValue } from '@/lib/orbit/status-style'
import { HowWhyDialog } from './how-why-dialog'
import { useOrbit } from './orbit-provider'
import { StatusPill } from './status-pill'
import { TrendChart } from './trend-chart'

export function OrganPanel({ id }: { id: OrganId }) {
  const { organs, env } = useOrbit()
  const state = organs.find((o) => o.organ.id === id)
  if (!state) return null
  const { organ, status, indicators } = state
  const routing = getRouting(status, env)
  const style = STATUS_STYLE[status]
  const projectable = id === 'bones' || id === 'muscles' || id === 'radiation'

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to Twin View
      </Link>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">Organ panel</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-semibold md:text-3xl">
            {organ.name}
            <StatusPill status={status} size="lg" />
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground md:text-base">
            {organ.description}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <ShieldAlert className="size-4 shrink-0 text-status-watch" aria-hidden />
          <span>
            <span className="text-muted-foreground">Space hazard: </span>
            <span className="font-medium">{organ.hazard}</span>
          </span>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="indicators-title" className="flex flex-col gap-4">
          <h2 id="indicators-title" className="text-lg font-semibold">
            Today vs your normal
          </h2>
          {indicators.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </section>

        <section aria-labelledby="actions-title" className="flex flex-col gap-4">
          <h2 id="actions-title" className="text-lg font-semibold">
            What to do
          </h2>
          <div className={cn('rounded-2xl border p-5', style.border, style.soft)}>
            <p className={cn('text-xs font-semibold tracking-wider uppercase', style.text)}>
              {style.label} · {env.name}
            </p>
            <p className="mt-1 text-lg font-semibold">{routing.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{routing.detail}</p>
            <p className="mt-3 flex items-center gap-2 text-sm">
              <UserRound className="size-4 text-primary" aria-hidden />
              <span className="text-muted-foreground">Who to contact:</span>
              <span className="font-medium">{routing.contact}</span>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">
              {status === 'normal' ? 'Prevention' : 'Recommended actions'}
            </h3>
            <ol className="mt-3 flex flex-col gap-3">
              {organ.actions[status].map((action, i) => (
                <li key={action} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ol>
            {organ.medicalKit && status !== 'normal' && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
                <Briefcase className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="text-muted-foreground">Medical kit: </span>
                  {organ.medicalKit}
                </span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {status !== 'normal' && (
                <Button nativeButton={false} render={<Link href="/actions" />}>Open Action Center</Button>
              )}
              {projectable && (
                <Button variant="outline" nativeButton={false} render={<Link href="/future" />}>
                  <Hourglass aria-hidden />
                  See the future
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function IndicatorCard({ indicator }: { indicator: IndicatorState }) {
  const { meta, value, baseline, status, message, id } = indicator
  const style = STATUS_STYLE[status]
  const baselineLabel =
    id === 'radiationDose' ? 'Career limit' : id === 'crewPulse' ? 'Expected' : 'Your normal'

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{meta.label}</h3>
          <p className={cn('mt-0.5 text-sm', status === 'normal' ? 'text-muted-foreground' : style.text)}>
            {message}
          </p>
        </div>
        <StatusPill status={status} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-secondary/70 p-3">
          <dt className="text-xs text-muted-foreground">Today</dt>
          <dd className={cn('font-mono text-2xl font-semibold', style.text)}>
            {formatValue(value, meta.decimals)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{meta.unit}</span>
          </dd>
        </div>
        <div className="rounded-lg bg-secondary/70 p-3">
          <dt className="text-xs text-muted-foreground">{baselineLabel}</dt>
          <dd className="font-mono text-2xl font-semibold">
            {formatValue(baseline, meta.decimals)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{meta.unit}</span>
          </dd>
        </div>
        <div className="col-span-2 flex items-end rounded-lg p-3 sm:col-span-1">
          <HowWhyDialog id={id} label="How & why" />
        </div>
      </dl>
      {id !== 'crewPulse' && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">Last 30 mission days</p>
          <TrendChart indicator={indicator} />
        </div>
      )}
    </article>
  )
}
