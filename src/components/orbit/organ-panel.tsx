import { Link } from 'react-router-dom'
import { ArrowLeft, Briefcase, CircleHelp, Hourglass, ListChecks, ShieldAlert, UserRound } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getRouting } from '@/lib/orbit/health'
import { buildAnswers, isUnknown, organShownStatus } from '@/lib/orbit/organ-explain'
import type { OrganId } from '@/lib/orbit/organs'
import { styleFor } from '@/lib/orbit/status-style'
import { IndicatorCard } from './indicator-card'
import { OrganAnswersRow } from './organ-answers'
import { OrganSources } from './organ-sources'
import { useOrbit } from './orbit-provider'
import { StatusPill } from './status-pill'
import { SYMPTOMS } from '@/lib/orbit/symptoms'

export function OrganPanel({ id }: { id: OrganId }) {
  const { organs, env, astronaut, symptomsToday } = useOrbit()
  const state = organs.find((o) => o.organ.id === id)
  if (!state) return null

  const { organ, indicators } = state
  const symptoms = SYMPTOMS.filter((s) => s.organ === id && symptomsToday.includes(s.id))
  const status = organShownStatus(state)
  const answers = buildAnswers(state, symptoms)
  const missing = indicators.filter(isUnknown)
  const { todo } = answers
  const routing = getRouting(todo.status, env)
  const todoStyle = styleFor(todo.status)
  const projectable = id === 'bones' || id === 'muscles' || id === 'radiation'
  const flagged = todo.status !== 'normal'

  return (
    <div className="flex flex-col gap-6">
      <Link
        to="/"
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
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <ShieldAlert className="size-4 shrink-0 text-status-watch" aria-hidden />
            <span>
              <span className="text-muted-foreground">Space hazard: </span>
              <span className="font-medium">{organ.hazard}</span>
            </span>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {astronaut.name} · last check-in {astronaut.lastCheckIn} · simulated demo data
          </p>
        </div>
      </header>

      {missing.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/60 p-4 text-sm"
        >
          <CircleHelp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-medium">
              {missing.length} of {indicators.length} readings missing:{' '}
              {missing.map((m) => m.meta.label).join(', ')}.
            </span>{' '}
            <span className="text-muted-foreground">Missing data shows as Unknown, never as Normal.</span>
          </p>
          <ButtonLink variant="outline" to="/check-in">
            Open Daily Check-in
          </ButtonLink>
        </div>
      )}

      <OrganAnswersRow answers={answers} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="indicators-title" className="flex flex-col gap-4">
          <h2 id="indicators-title" className="text-lg font-semibold">
            Today vs your normal
          </h2>
          {indicators.map((indicator) => (
            <IndicatorCard key={indicator.id} indicator={indicator} />
          ))}
        </section>

        <section aria-labelledby="actions-title" className="order-first flex flex-col gap-4 xl:order-none">
          <h2 id="actions-title" className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="size-5 text-primary" aria-hidden />
            What should I do?
          </h2>

          {flagged && (
            <div className={cn('rounded-2xl border p-5', todoStyle.border, todoStyle.soft)}>
              <p className={cn('text-xs font-semibold tracking-wider uppercase', todoStyle.text)}>
                {todoStyle.label} · {env.name}
              </p>
              <p className="mt-1 text-lg font-semibold">{routing.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{routing.detail}</p>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <UserRound className="size-4 text-primary" aria-hidden />
                <span className="text-muted-foreground">Who to contact:</span>
                <span className="font-medium">{routing.contact}</span>
              </p>
              <p className="mt-3 border-t border-border/60 pt-3 text-xs leading-relaxed text-muted-foreground">
                Distance from Earth changes who you contact. It never changes how serious this is.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-semibold">{flagged ? 'Recommended steps' : 'Prevention'}</h3>
            <ol className="mt-3 flex flex-col gap-3">
              {todo.needsCheckIn && (
                <li className="flex gap-3 text-sm leading-relaxed">
                  <StepNumber n={1} />
                  Take the missing reading in Daily Check-in. Repeat it once if you were moving or the sensor was loose.
                </li>
              )}
              {todo.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm leading-relaxed">
                  <StepNumber n={i + 1 + (todo.needsCheckIn ? 1 : 0)} />
                  {step}
                </li>
              ))}
            </ol>
            {organ.medicalKit && flagged && (
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
                <Briefcase className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="text-muted-foreground">Medical kit: </span>
                  {organ.medicalKit}
                </span>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {todo.needsCheckIn && (
                <ButtonLink to="/check-in">Open Daily Check-in</ButtonLink>
              )}
              {flagged && (
                <ButtonLink variant={todo.needsCheckIn ? 'outline' : 'default'} to="/actions">
                  Open Action Center
                </ButtonLink>
              )}
              {projectable && (
                <ButtonLink variant="outline" to="/future">
                  <Hourglass aria-hidden />
                  See the future
                </ButtonLink>
              )}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Demo thresholds and placeholder protocols. Not medical advice. Follow your approved onboard protocol.
            </p>
          </div>
        </section>
      </div>

      <OrganSources id={id} />
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs font-semibold text-primary">
      {n}
    </span>
  )
}
