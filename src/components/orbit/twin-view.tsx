
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight, ClipboardCheck, Flame, Radiation, Siren, Users } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { formatDelay, isDeepSpace } from '@/lib/orbit/environments'
import { getRouting } from '@/lib/orbit/health'
import { RADIATION_CAREER_LIMIT } from '@/lib/orbit/indicators'
import type { OrganId } from '@/lib/orbit/organs'
import { STATUS_STYLE, formatValue } from '@/lib/orbit/status-style'
import { BodyTwin, StatusLegend } from './body-twin'
import { useOrbit } from './orbit-provider'
import { StatusPill } from './status-pill'

export function TwinView() {
  const { astronaut, env, organs, alerts, indicators, streak, checkedInToday } = useOrbit()
  const firstName = astronaut.name.split(' ')[0]
  const statuses = Object.fromEntries(organs.map((o) => [o.organ.id, o.status])) as Record<
    OrganId,
    (typeof organs)[number]['status']
  >
  const worst = alerts[0]?.status ?? 'normal'
  const routing = getRouting(worst, env)
  const dosePct = Math.round((indicators.radiationDose.value / RADIATION_CAREER_LIMIT) * 100)

  const headline =
    alerts.length === 0
      ? 'All systems are within your normal.'
      : `${alerts.length} ${alerts.length === 1 ? 'system needs' : 'systems need'} your attention.`

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="twin-greeting"
        className={cn(
          'relative overflow-hidden rounded-2xl border bg-card p-5 md:p-6',
          STATUS_STYLE[worst].border,
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="font-mono text-xs tracking-[0.2em] text-primary uppercase">
              {env.name} · Day {MISSION_DAY}
            </p>
            <h1 id="twin-greeting" className="mt-1 text-2xl font-semibold text-balance md:text-3xl">
              Hi {firstName}. {headline}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground md:text-base">
              {alerts.length === 0
                ? 'Keep your routine going. Your twin will tell you the moment something drifts.'
                : isDeepSpace(env)
                  ? `Earth is ${formatDelay(env.delaySeconds)} away, so your first contact is the ${routing.contact.toLowerCase()}.`
                  : `You have near real-time contact with Earth. Next step: ${routing.title.toLowerCase()}.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!checkedInToday && (
              <ButtonLink to="/check-in">
                <ClipboardCheck aria-hidden />
                Start check-in
              </ButtonLink>
            )}
            {alerts.length > 0 && (
              <ButtonLink to="/actions" variant={checkedInToday ? 'default' : 'outline'}>
                <Siren aria-hidden />
                What should I do?
              </ButtonLink>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-labelledby="body-title" className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="body-title" className="text-lg font-semibold">
              Your twin
            </h2>
            <span className="text-xs text-muted-foreground">Tap a body part</span>
          </div>
          <BodyTwin statuses={statuses} />
          <StatusLegend className="mt-4 justify-center" />
        </section>

        <div className="flex flex-col gap-6">
          <section aria-labelledby="systems-title">
            <h2 id="systems-title" className="mb-3 text-lg font-semibold">
              Body systems
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {organs.map(({ organ, status, indicators: states }) => {
                const lead = [...states].sort((a, b) =>
                  a.status === b.status ? 0 : a.status === 'normal' ? 1 : -1,
                )[0]
                return (
                  <li key={organ.id}>
                    <Link
                      to={`/organ/${organ.id}`}
                      className={cn(
                        'group flex h-full flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        status === 'normal' ? 'border-border' : STATUS_STYLE[status].border,
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{organ.name}</span>
                        <StatusPill status={status} />
                      </div>
                      <p className="font-mono text-xl font-semibold">
                        {formatValue(lead.value, lead.meta.decimals)}
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {lead.meta.unit}
                        </span>
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        <span className="text-foreground">{lead.meta.label}.</span> {lead.message}
                      </p>
                      <span className="mt-auto flex items-center gap-1 text-xs font-medium text-primary">
                        Open panel
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section aria-label="Mission stats" className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Flame className="size-4 text-status-watch" aria-hidden />}
              label="Check-in streak"
              value={`${streak} days`}
              href="/mission"
            />
            <StatCard
              icon={<Radiation className="size-4 text-primary" aria-hidden />}
              label="Radiation budget used"
              value={`${dosePct}%`}
              href="/organ/radiation"
            />
            <StatCard
              icon={<Users className="size-4 text-primary" aria-hidden />}
              label="Crew Pulse"
              value={indicators.crewPulse.value === 0 ? 'All clear' : `${indicators.crewPulse.value} flags`}
              href="/crew"
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode
  label: string
  value: string
  href: string
}) {
  return (
    <Link
      to={href}
      className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </p>
        <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}
