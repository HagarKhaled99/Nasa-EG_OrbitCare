/**
 * Twin View (Member 2, Omar): the ORBIT TWIN home screen.
 * Ported from the member2-twin-view branch (Next.js) into the Vite app: react-router links, plain <img>,
 * and the shared session from OrbitProvider instead of the Next.js session gate.
 *
 * Layout: the body twin on a scan grid (left); beside it, today's read and one
 * personal-baseline strip per body system. Below: the comms panel (distance
 * from Earth and who you contact) and NASA's RIDGE hazards. Colors come from
 * the app theme (globals.css). All logic lives in lib/orbit/twin.ts so the
 * page and /api/twin agree.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Droplet,
  ExternalLink,
  Gauge,
  Globe2,
  Inbox,
  Lock,
  LogOut,
  Radiation,
  Rocket,
  Siren,
  Sun,
  Thermometer,
  User,
  Users,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatValue } from '@/lib/orbit/status-style'
import {
  CONJUNCTION_SOURCES,
  DATA_SOURCES,
  HAZARDS,
  REFERENCES,
  buildTwinSnapshot,
  type DataSourceId,
  type TwinIndicatorSummary,
  type CommsWindow,
  type TwinOrganCard,
  type TwinSnapshot,
  type TwinStatus,
} from '@/lib/orbit/twin'
import { ENVIRONMENTS } from '@/lib/orbit/environments'
import type { OrganId } from '@/lib/orbit/organs'
import { isSampleCrew } from '@/lib/orbit/profiles'
import { useOrbit } from './orbit-provider'

// ---------------------------------------------------------------------------
// Look & feel: the app's own lilac theme tokens (globals.css) throughout.
// ---------------------------------------------------------------------------

const TWIN_CSS = `
.twin-monitor {
  background:
    radial-gradient(70% 50% at 50% 42%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 75%),
    var(--card);
}
.twin-grid {
  background-image:
    linear-gradient(color-mix(in oklch, var(--primary) 9%, transparent) 1px, transparent 1px),
    linear-gradient(90deg, color-mix(in oklch, var(--primary) 9%, transparent) 1px, transparent 1px);
  background-size: 22px 22px;
}
.twin-sweep {
  position: absolute; left: 0; right: 0; height: 12%; top: -12%;
  background: linear-gradient(180deg, transparent, color-mix(in oklch, var(--primary) 7%, transparent) 70%, color-mix(in oklch, var(--primary) 18%, transparent) 100%);
  border-bottom: 1px solid color-mix(in oklch, var(--primary) 35%, transparent);
  animation: twin-sweep 5.5s cubic-bezier(.45,.05,.55,.95) infinite;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(90deg, transparent, black 25%, black 75%, transparent);
  mask-image: linear-gradient(90deg, transparent, black 25%, black 75%, transparent);
}
@keyframes twin-sweep { 0% { top: -12% } 100% { top: 100% } }
.twin-blink { animation: twin-blink 1.6s steps(2, start) infinite; }
@keyframes twin-blink { 50% { opacity: .2 } }
.twin-ping { animation: twin-ping 2.4s ease-out infinite; }
@keyframes twin-ping { 0% { transform: scale(1); opacity: .7 } 100% { transform: scale(2.6); opacity: 0 } }
.twin-signal { animation: twin-signal var(--twin-signal, 3s) linear infinite; }
@keyframes twin-signal { 0% { left: 0%; opacity: 0 } 8% { opacity: 1 } 92% { opacity: 1 } 100% { left: 100%; opacity: 0 } }
.twin-blocked { animation: twin-blocked 1.4s ease-in-out infinite; }
@keyframes twin-blocked { 50% { opacity: .35 } }
@media (prefers-reduced-motion: reduce) {
  .twin-blocked { animation: none }
  .twin-sweep { display: none }
  .twin-blink, .twin-ping, .twin-signal { animation: none }
}
`

/** The app's own status tokens, used for the scan points and their readouts. */
const STATUS_COLOR: Record<TwinStatus, string> = {
  normal: 'var(--status-ok)',
  watch: 'var(--status-watch)',
  act: 'var(--status-act)',
  unknown: 'var(--muted-foreground)',
}

const LABEL: Record<TwinStatus, string> = { normal: 'Normal', watch: 'Watch', act: 'Act', unknown: 'Unknown' }

/** Tailwind classes for the light page, from the app's status tokens. */
const TONE: Record<TwinStatus, { text: string; dot: string; soft: string; ring: string }> = {
  normal: { text: 'text-status-ok', dot: 'bg-status-ok', soft: 'bg-status-ok/10', ring: 'ring-status-ok/30' },
  watch: { text: 'text-status-watch', dot: 'bg-status-watch', soft: 'bg-status-watch/10', ring: 'ring-status-watch/35' },
  act: { text: 'text-status-act', dot: 'bg-status-act', soft: 'bg-status-act/10', ring: 'ring-status-act/35' },
  unknown: { text: 'text-muted-foreground', dot: 'bg-muted-foreground/50', soft: 'bg-muted', ring: 'ring-muted-foreground/30' },
}

const RANK: Record<TwinStatus, number> = { act: 3, watch: 2, unknown: 1, normal: 0 }

const SOURCE_ICON: Record<DataSourceId, LucideIcon> = {
  watch: Watch,
  meter: Droplet,
  dosimeter: Radiation,
  cuff: Gauge,
  thermometer: Thermometer,
  self: User,
  crew: Users,
  model: Cpu,
}

/** Hotspot labels that sit on the left of their dot (matches the figure art). */
const LABEL_LEFT: OrganId[] = ['eyes', 'muscles', 'blood', 'bones']

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function useClock() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Mission elapsed time in NASA's DDD/HH:MM:SS style. Day 214 = 213 full days elapsed. */
function met(now: Date, missionDay: number) {
  return `${missionDay - 1}/${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function greeting(now: Date | null) {
  if (!now) return 'Hello'
  const h = now.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function pct(fraction: number) {
  return `${Math.round(Math.abs(fraction) * 100)}%`
}

/** Short readout used on the monitor callouts and the strip value column. */
function deltaText(lead: TwinIndicatorSummary) {
  if (lead.deviation === null) return null
  if (lead.meter === 'budget') return `${pct(lead.deviation)} of limit`
  if (Math.abs(lead.deviation) < 0.005) return 'on your normal'
  return `${lead.deviation > 0 ? '▲' : '▼'} ${pct(lead.deviation)}`
}

function valueText(lead: TwinIndicatorSummary) {
  if (lead.value === null) return '—'
  if (lead.meter === 'votes') return `${lead.value} flag${lead.value === 1 ? '' : 's'}`
  return `${formatValue(lead.value, lead.decimals)} ${lead.unit}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function TwinView() {
  const { astronaut, env, organs, indicators, readiness, streak, checkedInToday, symptomsToday } = useOrbit()
  const now = useClock()
  // Demo button for Earth-Independent Mode: pretend the Mars blackout starts today.
  const [blackoutDemo, setBlackoutDemo] = useState(false)

  const twin = useMemo(
    () =>
      buildTwinSnapshot({
        astronaut,
        env,
        indicators,
        organs,
        readiness,
        checkedInToday,
        forceBlackout: blackoutDemo,
        symptoms: symptomsToday,
      }),
    [astronaut, env, indicators, organs, readiness, checkedInToday, blackoutDemo, symptomsToday],
  )

  // When the twin was last recalculated from shared state (a check-in or env change updates it).
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  useEffect(() => setUpdatedAt(new Date()), [indicators, env])

  const rows = useMemo(() => [...twin.organs].sort((a, b) => RANK[b.status] - RANK[a.status]), [twin.organs])

  return (
    <div className="flex flex-col gap-6">
      <style>{TWIN_CSS}</style>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <TodayRead
          twin={twin}
          now={now}
          updatedAt={updatedAt}
          streak={streak}
          checkedInToday={checkedInToday}
          className="lg:col-start-2 lg:row-start-1"
        />
        <Monitor
          twin={twin}
          now={now}
          className="lg:sticky lg:top-24 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-start"
        />
        <BaselineBoard rows={rows} className="lg:col-start-2 lg:row-start-2" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <CommsPanel twin={twin} now={now} blackoutDemo={blackoutDemo} onBlackoutDemo={setBlackoutDemo} />
        <RidgePanel active={twin.activeHazards} />
      </div>

      <SourcesFooter twin={twin} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Today's read: the answer first
// ---------------------------------------------------------------------------

function TodayRead({
  twin,
  now,
  updatedAt,
  streak,
  checkedInToday,
  className,
}: {
  twin: TwinSnapshot
  now: Date | null
  updatedAt: Date | null
  streak: number
  checkedInToday: boolean
  className?: string
}) {
  const flagged = twin.counts.watch + twin.counts.act
  const tone = TONE[twin.overall]
  const { astronaut, signOut } = useOrbit()
  const navigate = useNavigate()
  const isNewProfile = !isSampleCrew(astronaut.id)
  return (
    <section aria-labelledby="twin-headline" className={cn('flex flex-col gap-4 pt-1', className)}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
        <span className="text-primary">
          {greeting(now)}, {twin.astronaut.firstName}
        </span>
        <span aria-hidden>/</span>
        <span>
          {twin.mission.missionName} · day {twin.mission.missionDay}
        </span>
      </p>

      <div className="flex items-start gap-4">
        <span aria-hidden className={cn('mt-3 size-3 shrink-0 rounded-full ring-8', tone.dot, tone.ring)} />
        <div className="min-w-0">
          <h1
            id="twin-headline"
            className="text-[1.85rem] leading-[1.1] font-semibold tracking-[-0.02em] text-balance md:text-[2.4rem]"
          >
            {twin.headline}
          </h1>
          <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {twin.subline}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pl-7">
        {flagged > 0 && (
          <ButtonLink to="/actions" className="h-11 px-4">
            <Siren aria-hidden />
            What should I do?
          </ButtonLink>
        )}
        {!checkedInToday && (
          <ButtonLink to="/check-in" variant={flagged > 0 ? 'outline' : 'default'} className="h-11 px-4">
            <ClipboardCheck aria-hidden />
            Start today&apos;s check-in
          </ButtonLink>
        )}
      </div>

      <dl className="ml-7 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-border pt-3 text-xs sm:grid-cols-4">
        <Meta
          label="Twin updated"
          value={updatedAt ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          live
        />
        <Meta label="Watch synced" value={twin.lastUpdate.watchLastSync} />
        <Meta
          label="Last check-in"
          value={twin.lastUpdate.lastCheckIn}
          warn={!checkedInToday && !twin.lastUpdate.lastCheckIn.startsWith('Today')}
        />
        <Meta label="Streak" value={`${streak} days`} />
      </dl>

      <div className="ml-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3.5 text-primary" aria-hidden />
          Private to {astronaut.name}. Only your PIN opens this twin.
        </span>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate('/login'))
          }}
          className="inline-flex items-center gap-1 rounded-md font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <LogOut className="size-3.5" aria-hidden />
          Sign out
        </button>
      </div>
      {isNewProfile && (
        <p className="ml-7 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
          <span className="font-semibold">Your twin is still learning your normal.</span> It compares you with the
          personal baseline you recorded at sign-up. Systems without readings show Unknown until your first{' '}
          <Link to="/check-in" className="font-medium text-primary underline-offset-2 hover:underline">
            daily check-in
          </Link>
          ; trends become reliable as your check-ins build up.
        </p>
      )}
    </section>
  )
}

function Meta({ label, value, warn, live }: { label: string; value: string; warn?: boolean; live?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn('mt-0.5 font-mono text-[13px] font-semibold tabular-nums', warn && 'text-status-watch')}
        aria-live={live ? 'polite' : undefined}
      >
        {value}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The monitor: body scan with live callouts
// ---------------------------------------------------------------------------

function Monitor({ twin, now, className }: { twin: TwinSnapshot; now: Date | null; className?: string }) {
  return (
    <section
      aria-labelledby="scan-title"
      className={cn(
        'twin-monitor relative overflow-hidden rounded-2xl border border-border p-4 sm:p-5',
        className,
      )}
    >
      <header className="relative z-10 flex items-start justify-between gap-3">
        <div>
          <h2 id="scan-title" className="text-lg font-semibold">
            Your twin
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {twin.astronaut.name} · {twin.astronaut.figure} body · tap a point
          </p>
        </div>
        <div className="text-right font-mono text-[10.5px] tracking-[0.14em] text-muted-foreground uppercase">
          <p className="flex items-center justify-end gap-1.5 text-status-ok">
            <span className="twin-blink size-1.5 rounded-full bg-status-ok" aria-hidden />
            Live
          </p>
          <p className="mt-1 text-foreground tabular-nums" aria-label="Mission elapsed time">
            MET {now ? met(now, twin.mission.missionDay) : `${twin.mission.missionDay - 1}/--:--:--`}
          </p>
        </div>
      </header>

      <div className="relative mx-auto mt-2 aspect-[768/1376] w-full max-w-[330px]">
        <div
          aria-hidden
          className="twin-grid absolute inset-[-12%] [mask-image:radial-gradient(closest-side,black,transparent)]"
        />
        <img
          src={`/images/body-twin-${twin.astronaut.figure}.png`}
          alt=""
          className="absolute inset-0 size-full object-contain [mask-image:radial-gradient(ellipse_50%_56%_at_center,black_72%,transparent_100%)]"
        />
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="twin-sweep" />
        </div>
        <Brackets />
        {twin.organs.map((card) => (
          <Hotspot key={card.id} card={card} />
        ))}
      </div>

      <ul className="relative z-10 mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs font-medium">
        {(['normal', 'watch', 'act', 'unknown'] as TwinStatus[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', s === 'unknown' && 'border border-dashed')}
              style={s === 'unknown' ? { borderColor: STATUS_COLOR[s] } : { background: STATUS_COLOR[s] }}
            />
            {LABEL[s]}
          </li>
        ))}
      </ul>
      <p className="relative z-10 mt-2 text-center text-xs text-muted-foreground">
        Colors compare today with <span className="text-foreground">your own</span> pre-flight baseline.
      </p>
    </section>
  )
}

function Brackets() {
  const base = 'absolute size-5 border-primary/35'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-[-4%] top-[1%] bottom-[-1%]">
      <span className={cn(base, 'top-0 left-0 border-t border-l')} />
      <span className={cn(base, 'top-0 right-0 border-t border-r')} />
      <span className={cn(base, 'bottom-0 left-0 border-b border-l')} />
      <span className={cn(base, 'right-0 bottom-0 border-r border-b')} />
    </div>
  )
}

function Hotspot({ card }: { card: TwinOrganCard }) {
  const color = STATUS_COLOR[card.status]
  const left = LABEL_LEFT.includes(card.id)
  const delta = deltaText(card.lead)
  const flagged = card.status === 'watch' || card.status === 'act'
  const reading =
    card.lead.meter === 'baseline' && card.lead.value !== null
      ? `${formatValue(card.lead.value, card.lead.decimals)}${card.lead.unit.length <= 4 ? ` ${card.lead.unit}` : ''}`
      : card.lead.meter === 'budget'
        ? delta
        : valueText(card.lead)
  return (
    <Link
      to={card.href}
      aria-label={`${card.name}: ${LABEL[card.status]}. ${card.lead.label} ${valueText(card.lead)}. Open details`}
      className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      style={{ left: `${card.position.x}%`, top: `${card.position.y}%` }}
    >
      <span className="relative flex size-5 items-center justify-center">
        {flagged && (
          <span aria-hidden className="twin-ping absolute inset-0 rounded-full" style={{ background: color }} />
        )}
        <span
          aria-hidden
          className={cn('relative size-3 rounded-full', card.status === 'unknown' && 'border-2 border-dashed bg-transparent')}
          style={
            card.status === 'unknown'
              ? { borderColor: color }
              : { background: color, boxShadow: `0 0 0 3px var(--card), 0 0 12px 2px color-mix(in oklch, ${color} 55%, transparent)` }
          }
        />
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap',
          left ? 'right-full mr-0.5 flex-row-reverse' : 'left-full ml-0.5',
        )}
      >
        <span className="h-px w-3 sm:w-4" style={{ background: color, opacity: 0.7 }} />
        <span
          className={cn(
            'rounded-md border bg-background/90 px-1.5 py-0.5 leading-tight shadow-sm backdrop-blur transition-colors group-hover:bg-secondary',
            left ? 'text-right' : 'text-left',
          )}
          style={{ borderColor: `color-mix(in oklch, ${color} 40%, var(--border))` }}
        >
          <span className="block text-[10.5px] font-semibold text-foreground">
            {card.shortName}
          </span>
          <span className="block font-mono text-[10.5px] font-semibold tabular-nums" style={{ color }}>
            {reading}
            {card.lead.meter === 'baseline' && delta && flagged && (
              <span className="ml-1 font-normal opacity-90">{delta}</span>
            )}
          </span>
        </span>
      </span>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Baseline board: one strip per body system, your normal in the middle
// ---------------------------------------------------------------------------

function BaselineBoard({ rows, className }: { rows: TwinOrganCard[]; className?: string }) {
  return (
    <section aria-labelledby="board-title" className={cn('rounded-3xl border border-border bg-card', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5 pb-3">
        <h2 id="board-title" className="text-base font-semibold">
          Your normal, system by system
        </h2>
        <p className="flex items-center gap-3 font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-px bg-foreground" />
            your normal
          </span>
          <span className="hidden sm:inline">30-day trend</span>
        </p>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((card) => (
          <li key={card.id}>
            <BaselineRow card={card} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BaselineRow({ card }: { card: TwinOrganCard }) {
  const { lead, status } = card
  const tone = TONE[status]
  const flagged = status !== 'normal'
  const SourceIcon = SOURCE_ICON[lead.source]
  const delta = deltaText(lead)

  return (
    <Link
      to={card.href}
      className={cn(
        'group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2.5 px-5 py-4 transition-colors hover:bg-secondary/70 focus-visible:bg-secondary focus-visible:outline-none sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_6.5rem_5.5rem]',
        flagged && tone.soft,
      )}
    >
      {/* name */}
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium">
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full',
              tone.dot,
              status === 'unknown' && 'border border-dashed border-muted-foreground bg-transparent',
            )}
          />
          <span className="leading-snug">{card.name}</span>
          <span className="sr-only">, {LABEL[status]}</span>
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate pl-4 text-xs text-muted-foreground">
          <SourceIcon className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{lead.label}</span>
        </p>
      </div>

      {/* value (mobile: top right) */}
      <div className="text-right sm:order-3">
        <p className="font-mono text-[15px] font-semibold tabular-nums">{valueText(lead)}</p>
        <p className={cn('font-mono text-[11px] tabular-nums', flagged ? tone.text : 'text-muted-foreground')}>
          {status === 'unknown' ? 'no reading' : (delta ?? LABEL[status])}
        </p>
      </div>

      {/* meter */}
      <div className="col-span-2 sm:order-2 sm:col-span-1">
        <Meter lead={lead} status={status} />
      </div>

      {/* trend */}
      <div className="hidden sm:order-4 sm:block">
        <Sparkline lead={lead} status={status} />
      </div>

      {flagged && (
        <p className="col-span-2 flex items-start gap-2 text-[13px] leading-snug sm:order-5 sm:col-span-4 sm:pl-4">
          <span className={cn('mt-px shrink-0 font-mono text-[10.5px] font-semibold tracking-[0.12em] uppercase', tone.text)}>
            Next step
          </span>
          <span className="min-w-0 flex-1">{card.nextStep}</span>
          <ChevronRight
            className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </p>
      )}
      {lead.freshness === 'earlier' && (
        <p className="col-span-2 -mt-1 pl-4 text-[11px] text-status-watch sm:order-6 sm:col-span-4">
          Not measured today. Showing your last check-in.
        </p>
      )}
    </Link>
  )
}

/**
 * Baseline meter. Every row uses the same geometry: the centre line is your
 * normal, the inner band is your normal range, then watch, then act. Each
 * indicator keeps its own thresholds (temperature drifts far less than
 * sleep), so the picture means the same thing on every row.
 */
function Meter({ lead, status }: { lead: TwinIndicatorSummary; status: TwinStatus }) {
  if (status === 'unknown' || lead.deviation === null) {
    return (
      <div
        className="h-2.5 rounded-full border border-dashed border-muted-foreground/50 bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--muted)_5px_7px)]"
        role="img"
        aria-label="No valid reading"
      />
    )
  }

  if (lead.meter === 'budget') {
    const used = Math.min(1, lead.deviation)
    return (
      <div role="img" aria-label={`${pct(used)} of career radiation limit used`} className="relative h-2.5 overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-[70%] w-[20%] bg-status-watch/25" />
        <div className="absolute inset-y-0 left-[90%] w-[10%] bg-status-act/25" />
        <div className={cn('absolute inset-y-0 left-0 rounded-full', TONE[status].dot)} style={{ width: `${used * 100}%` }} />
      </div>
    )
  }

  if (lead.meter === 'votes') {
    const flags = lead.value ?? 0
    return (
      <div role="img" aria-label={`${flags} of 3 crewmates flagged a change`} className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn('h-2.5 flex-1 rounded-full', i < flags ? TONE[status].dot : 'bg-muted')} />
        ))}
      </div>
    )
  }

  // Baseline: the track spans ±2× the act threshold; act starts at the quarter marks.
  const span = lead.actPct * 2
  const toX = (d: number) => 50 + (Math.max(-span, Math.min(span, d)) / span) * 50
  const watchOff = (lead.watchPct / span) * 50
  const actOff = 25
  const lowBad = lead.bad !== 'high'
  const highBad = lead.bad !== 'low'
  const x = toX(lead.deviation)
  const clipped = Math.abs(lead.deviation) > span

  return (
    <div role="img" aria-label={`${lead.label}: ${deltaText(lead) ?? ''} compared with your normal`} className="relative h-2.5">
      <div className="absolute inset-0 overflow-hidden rounded-full bg-status-ok/15">
        {lowBad && (
          <>
            <div className="absolute inset-y-0 left-0 bg-status-act/25" style={{ width: `${50 - actOff}%` }} />
            <div
              className="absolute inset-y-0 bg-status-watch/25"
              style={{ left: `${50 - actOff}%`, width: `${actOff - watchOff}%` }}
            />
          </>
        )}
        {highBad && (
          <>
            <div
              className="absolute inset-y-0 bg-status-watch/25"
              style={{ left: `${50 + watchOff}%`, width: `${actOff - watchOff}%` }}
            />
            <div className="absolute inset-y-0 right-0 bg-status-act/25" style={{ width: `${50 - actOff}%` }} />
          </>
        )}
        <div
          className="absolute inset-y-0 bg-status-ok/35"
          style={{ left: `${50 - watchOff}%`, width: `${watchOff * 2}%` }}
        />
      </div>
      <span aria-hidden className="absolute -top-1 -bottom-1 left-1/2 w-px bg-foreground/70" />
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow',
          TONE[status].dot,
          clipped && 'rounded-sm',
        )}
        style={{ left: `${x}%` }}
      />
    </div>
  )
}

function Sparkline({ lead, status }: { lead: TwinIndicatorSummary; status: TwinStatus }) {
  const pts = lead.history
  if (pts.length < 2) {
    return <p className="text-right font-mono text-[10.5px] text-muted-foreground">no trend</p>
  }
  const w = 88
  const h = 30
  const values = pts.map((p) => p.value)
  if (lead.baseline !== null) values.push(lead.baseline)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const x = (i: number) => 3 + (i / (pts.length - 1)) * (w - 7)
  const y = (v: number) => h - 4 - ((v - min) / range) * (h - 8)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const endColor =
    status === 'normal'
      ? 'var(--status-ok)'
      : status === 'watch'
        ? 'var(--status-watch)'
        : status === 'act'
          ? 'var(--status-act)'
          : 'var(--muted-foreground)'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="ml-auto h-[30px] w-[88px]" role="img" aria-label={`${lead.label}, last ${pts.length} days`}>
      {lead.baseline !== null && (
        <line
          x1="0"
          x2={w}
          y1={y(lead.baseline)}
          y2={y(lead.baseline)}
          stroke="var(--muted-foreground)"
          strokeOpacity="0.45"
          strokeDasharray="2 3"
          strokeWidth="1"
        />
      )}
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pts.length - 1)} cy={y(last.value)} r="3" fill={endColor} stroke="var(--card)" strokeWidth="1.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Comms: distance from Earth and who you contact
// ---------------------------------------------------------------------------

function CommsPanel({
  twin,
  now,
  blackoutDemo,
  onBlackoutDemo,
}: {
  twin: TwinSnapshot
  now: Date | null
  blackoutDemo: boolean
  onBlackoutDemo: (on: boolean) => void
}) {
  const { setEnvironmentId } = useOrbit()
  const m = twin.mission
  const fx = m.effects
  const comms = twin.comms
  const blackout = comms.state === 'blackout'
  // Animation length grows with distance (log scale), so Mars visibly takes longer than the ISS.
  const signalSeconds = Math.min(7, 1.2 + Math.log10(1 + m.earthDelaySeconds) * 1.7)
  const place = m.environmentName.split(' · ')[0]
  return (
    <section aria-labelledby="comms-title" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-muted-foreground uppercase">
        Mission environment · one-way signal {m.earthDelayLabel}
      </p>
      <h2 id="comms-title" className="mt-2 text-xl leading-snug font-semibold tracking-[-0.01em] text-balance sm:text-2xl">
        Your flight surgeon is {m.earthDelayLabel} away. <span className="text-primary">Your twin is right here.</span>
      </h2>

      <EarthLink comms={comms} missionDay={m.missionDay} blackoutDemo={blackoutDemo} onBlackoutDemo={onBlackoutDemo} />

      <div className="mt-4" role="group" aria-label="Where are you?">
        <p className="mb-2 text-xs text-muted-foreground">Where are you? Change it to see your numbers update.</p>
        <div className="flex flex-wrap gap-1.5">
          {ENVIRONMENTS.map((env) => {
            const on = env.id === m.environmentId
            return (
              <button
                key={env.id}
                type="button"
                aria-pressed={on}
                onClick={() => setEnvironmentId(env.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary/60 text-secondary-foreground hover:bg-secondary',
                )}
              >
                {env.name.replace(' · ', ' ')}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3" aria-hidden>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold">
          <Rocket className="size-4 text-primary" />
          <span className="hidden sm:inline">{place}</span>
        </span>
        <div className="relative h-6 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px bg-[repeating-linear-gradient(90deg,var(--border)_0_6px,transparent_6px_10px)]" />
          {blackout ? (
            <>
              <span className="twin-blocked absolute top-1/2 left-[38%] size-2.5 -translate-y-1/2 rounded-full bg-muted-foreground" />
              <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-status-watch/20">
                <Sun className="size-4 text-status-watch" />
              </span>
            </>
          ) : (
            <span
              key={m.environmentId}
              className="twin-signal absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_20%,transparent)]"
              style={{ ['--twin-signal' as string]: `${signalSeconds}s` }}
            />
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold">
          Earth
          <Globe2 className="size-4 text-status-ok" />
        </span>
      </div>
      <p className="mt-1 text-center font-mono text-[11px] text-muted-foreground">
        {blackout ? 'signal scrambled by the Sun' : `round trip ${m.roundTripLabel}`} · {m.environmentName}
      </p>

      <TimeGap comms={comms} now={now} delaySeconds={m.earthDelaySeconds} />

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">If you need help right now, the chain is:</p>
        <ol className="mt-2 flex flex-wrap items-center gap-1.5">
          {twin.contactChain.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              {i > 0 && <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />}
              <span
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium',
                  i === 0 ? 'bg-secondary text-secondary-foreground' : 'bg-primary text-primary-foreground',
                )}
              >
                {step}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          Distance and blackouts change <span className="font-medium text-foreground">who</span> you contact. They
          never change how serious a reading is.
        </p>
      </div>

      <h3 className="mt-5 text-sm font-semibold">What {place} does to you</h3>
      <dl
        key={m.environmentId}
        className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4"
      >
        <Fact label="Gravity" value={fx.gravityLabel} />
        <Fact label="Day and night" value={fx.dayCycle} small />
        <Fact label="Radiation" value={`${fx.radiationPerDay} mSv/day`} />
        <Fact label="Next 30 days" value={`${fx.dose30Days} mSv`} />
        <Fact label="Bone loss" value={`${fx.boneLossPerMonth}% / month`} hint={`${fx.boneLossNoExercise}% without exercise`} />
        <Fact label="Muscle loss" value={`${fx.muscleLossPerMonth}% / month`} />
        <Fact label="Back to Earth" value={fx.returnToEarth} small />
        <Fact label="Dose budget" value={`${m.radiationBudgetPct}% used`} />
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Illustrative, research-informed estimates for your exercise level, not predictions. Radiation: {fx.source}.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Earth-Independent Mode: comms timeline, blackout state, "what Earth sees"
// ---------------------------------------------------------------------------

function EarthLink({
  comms,
  missionDay,
  blackoutDemo,
  onBlackoutDemo,
}: {
  comms: CommsWindow
  missionDay: number
  blackoutDemo: boolean
  onBlackoutDemo: (on: boolean) => void
}) {
  const tone =
    comms.state === 'blackout'
      ? 'border-foreground bg-foreground text-background'
      : comms.state === 'pre-blackout'
        ? 'border-status-watch/40 bg-status-watch/10'
        : 'border-status-ok/30 bg-status-ok/10'
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className={cn('rounded-2xl border p-4 transition-colors', tone)} role="status" aria-live="polite">
        <p className="flex items-center gap-2 font-mono text-[10.5px] font-semibold tracking-[0.16em] uppercase opacity-80">
          {comms.state === 'blackout' ? (
            <Sun className="size-3.5" aria-hidden />
          ) : (
            <span aria-hidden className={cn('size-2 rounded-full', comms.state === 'pre-blackout' ? 'bg-status-watch' : 'bg-status-ok')} />
          )}
          {comms.state === 'blackout'
            ? 'Earth-independent mode'
            : comms.state === 'pre-blackout'
              ? 'Blackout coming'
              : 'Earth link'}
        </p>
        <p className="mt-1 text-base font-semibold">{comms.title}</p>
        <p className={cn('mt-0.5 text-sm', comms.state === 'blackout' ? 'opacity-85' : 'text-muted-foreground')}>
          {comms.detail}
        </p>
        {comms.prepAdvice && (
          <p className="mt-2 rounded-xl bg-card px-3 py-2 text-sm text-foreground">
            <span className="font-semibold">Before it starts: </span>
            {comms.prepAdvice}
          </p>
        )}
        {comms.state === 'blackout' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs opacity-85">
            <Inbox className="size-3.5" aria-hidden />
            Reports are saved on board and sent automatically on day {comms.blackoutEndDay}.
          </p>
        )}
      </div>

      {comms.hasConjunction && comms.blackoutStartDay !== null && comms.blackoutEndDay !== null && (
        <CommsTimeline
          today={missionDay}
          start={comms.blackoutStartDay}
          end={comms.blackoutEndDay}
          blackout={comms.state === 'blackout'}
        />
      )}

      {comms.hasConjunction ? (
        <button
          type="button"
          onClick={() => onBlackoutDemo(!blackoutDemo)}
          aria-pressed={blackoutDemo}
          className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Sun className="size-3.5 text-status-watch" aria-hidden />
          {blackoutDemo ? 'End the blackout demo' : 'Demo: start the blackout now'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Long blackouts only happen on Mars missions, when the Sun passes between Earth and Mars (about every 2
          years). Pick a Mars place below to see Earth-independent mode.
        </p>
      )}
    </div>
  )
}

/** Next 30 mission days: when Earth can be reached, and the blackout window. */
function CommsTimeline({ today, start, end, blackout }: { today: number; start: number; end: number; blackout: boolean }) {
  const span = 30
  const pos = (day: number) => `${Math.max(0, Math.min(100, ((day - today) / span) * 100))}%`
  const width = `${Math.max(0, Math.min(100, ((end - Math.max(start, today)) / span) * 100))}%`
  return (
    <div>
      <div
        className="relative h-7 overflow-hidden rounded-full bg-status-ok/15"
        role="img"
        aria-label={`Earth reachable until day ${start}, no contact from day ${start} to day ${end}`}
      >
        <div
          className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,color-mix(in_oklch,var(--status-watch)_45%,transparent)_0_6px,color-mix(in_oklch,var(--status-watch)_20%,transparent)_6px_12px)]"
          style={{ left: pos(Math.max(start, today)), width }}
        />
        <span className="absolute inset-y-0 left-0 w-0.5 bg-foreground" aria-hidden />
        <span
          className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[10px] font-semibold whitespace-nowrap"
          style={{ left: pos(Math.max(start, today)) }}
        >
          {blackout ? `Sun scrambles signal · until day ${end}` : `Sun scrambles signal · day ${start} to ${end}`}
        </span>
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-muted-foreground">
        <span className="absolute left-0">Today · day {today}</span>
        <span className="absolute right-0">
          {blackout ? `Earth back on day ${end}` : 'Green: Earth in contact'}
        </span>
      </div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
        Demo dates for this mission. NASA: it happens about every 2 years, NASA pauses commands for about 2 weeks
        (Nov 11 to 25, 2023), and for about 2 days there is no signal at all.{' '}
        {CONJUNCTION_SOURCES.map((src, i) => (
          <a
            key={src.url}
            href={src.url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            {i === 0 ? 'Source' : 'NASA 2023'}
            {i === 0 ? ', ' : ''}
          </a>
        ))}
      </p>
    </div>
  )
}

/** You see your data now; Earth sees it later (or not at all in a blackout). */
function TimeGap({ comms, now, delaySeconds }: { comms: CommsWindow; now: Date | null; delaySeconds: number }) {
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const earthTime = now ? new Date(now.getTime() - delaySeconds * 1000) : null
  const blackout = comms.state === 'blackout'
  return (
    <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
      <div className="bg-card px-3 py-2.5">
        <p className="text-[11px] text-muted-foreground">Your twin sees</p>
        <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums">{now ? fmt(now) : '—'}</p>
        <p className="text-[10.5px] text-status-ok">live, on board</p>
      </div>
      <div className={cn('px-3 py-2.5', blackout ? 'bg-muted' : 'bg-card')}>
        <p className="text-[11px] text-muted-foreground">Flight surgeon on Earth sees</p>
        <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums">
          {blackout ? 'Nothing reliable' : earthTime ? fmt(earthTime) : '—'}
        </p>
        <p className={cn('text-[10.5px]', blackout ? 'text-status-watch' : 'text-muted-foreground')}>{comms.earthSees}</p>
      </div>
    </div>
  )
}

function Fact({ label, value, hint, small }: { label: string; value: string; hint?: string; small?: boolean }) {
  return (
    <div className="bg-card px-3 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 font-semibold tabular-nums', small ? 'text-[12.5px] leading-snug' : 'font-mono text-[13px]')}>
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</dd>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RIDGE: NASA's five spaceflight hazards
// ---------------------------------------------------------------------------

function RidgePanel({ active }: { active: string[] }) {
  const on = HAZARDS.filter((h) => active.includes(h.id))
  return (
    <section aria-labelledby="ridge-title" className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-muted-foreground uppercase">NASA HRP · five hazards</p>
      <h2 id="ridge-title" className="mt-2 text-base font-semibold">
        What spaceflight is doing to you today
      </h2>

      <ul className="mt-4 grid grid-cols-5 gap-1.5" aria-label="RIDGE hazards">
        {HAZARDS.map((h) => {
          const lit = active.includes(h.id)
          return (
            <li
              key={h.id}
              className={cn('flex flex-col items-center rounded-2xl py-3', lit ? 'bg-status-watch/12' : 'bg-secondary/60')}
            >
              <span
                aria-hidden
                className={cn(
                  'text-[2.4rem] leading-none font-bold tracking-tight sm:text-5xl',
                  lit ? 'text-status-watch' : 'text-foreground/15',
                )}
              >
                {h.letter}
              </span>
              <span
                className={cn('mt-1.5 text-[10px] font-medium sm:text-[11px]', lit ? 'text-foreground' : 'text-muted-foreground')}
              >
                {h.name}
              </span>
              <span className="sr-only">{lit ? ': affecting you now' : ': not flagged'}</span>
            </li>
          )
        })}
      </ul>

      {on.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {on.map((h) => (
            <li key={h.id} className="text-sm leading-snug">
              <span className="font-semibold">{h.name}.</span> <span className="text-muted-foreground">{h.plain}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">No hazard is pushing any of your systems out of range today.</p>
      )}

      <a
        href={HAZARDS[0].sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
      >
        Source: NASA Human Research Program
        <ExternalLink className="size-3" aria-hidden />
      </a>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Sources and references
// ---------------------------------------------------------------------------

function SourcesFooter({ twin }: { twin: TwinSnapshot }) {
  const order = Object.keys(SOURCE_ICON) as DataSourceId[]
  const when = (id: DataSourceId) =>
    id === 'watch'
      ? twin.lastUpdate.watchLastSync
      : id === 'cuff' || id === 'thermometer' || id === 'meter' || id === 'self'
        ? twin.lastUpdate.lastCheckIn
        : id === 'model'
          ? 'live'
          : 'daily'
  return (
    <footer className="flex flex-col gap-3 border-t border-border pt-5 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <span className="mr-1 font-mono text-[10.5px] tracking-[0.16em] uppercase">Data from</span>
        {order
          .filter((id) => twin.sourcesInUse.includes(id))
          .map((id) => {
            const Icon = SOURCE_ICON[id]
            return (
              <span
                key={id}
                title={DATA_SOURCES[id].detail}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1"
              >
                <Icon className="size-3.5 text-primary" aria-hidden />
                <span className="font-medium text-foreground">{DATA_SOURCES[id].label}</span>
                <span className="font-mono">{when(id)}</span>
                {DATA_SOURCES[id].simulated && <span className="sr-only">(simulated)</span>}
              </span>
            )
          })}
        <span className="ml-auto rounded-md border border-dashed border-primary/50 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-primary">
          {twin.dataLabel}
        </span>
      </div>
      <details>
        <summary className="cursor-pointer font-medium text-primary">About this data and science references</summary>
        <p className="mt-2 max-w-[75ch]">
          Hackathon prototype. Every reading is a synthetic demo value, not a real astronaut measurement, and this is
          not a medical diagnostic tool. Watch and dosimeter feeds are simulated. Bone and muscle are model
          estimates, not scans. The pages below are the science references behind the hazards and risks, not the
          source of the numbers.
        </p>
        <ul className="mt-2 flex flex-col gap-1">
          {REFERENCES.map((ref) => (
            <li key={ref.url}>
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
              >
                {ref.label}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      </details>
    </footer>
  )
}
