'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Dumbbell, ShieldCheck } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { EXERCISE_PLAN_MINUTES, MISSION_DAY } from '@/lib/orbit/crew'
import { ENVIRONMENTS, type MissionEnvironment } from '@/lib/orbit/environments'
import {
  boneDensityAt,
  deviationStatus,
  muscleMassAt,
  radiationAt,
  type Status,
} from '@/lib/orbit/health'
import { INDICATORS, RADIATION_CAREER_LIMIT } from '@/lib/orbit/indicators'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { BodyTwin, StatusLegend } from './body-twin'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'
import { StatusPill } from './status-pill'

const MAX_DAY = 900
const PRESETS = [100, 300, 500, 900]

function radiationStatus(dose: number): Status {
  const f = dose / RADIATION_CAREER_LIMIT
  return f >= 0.9 ? 'act' : f >= 0.7 ? 'watch' : 'normal'
}

function project(day: number, env: MissionEnvironment, plan: boolean, actualRatio: number) {
  const ratio = plan ? 1 : 0
  const pastDay = Math.min(day, MISSION_DAY)
  const futureDays = Math.max(0, day - MISSION_DAY)
  const bone =
    boneDensityAt(pastDay, env, actualRatio) - (100 - boneDensityAt(futureDays, env, ratio))
  const muscle =
    muscleMassAt(pastDay, env, actualRatio) - (100 - muscleMassAt(futureDays, env, ratio))
  const dose = radiationAt(pastDay, env) + radiationAt(futureDays, env, plan)
  return {
    bone,
    muscle,
    dose,
    boneStatus: deviationStatus(bone, 100, INDICATORS.boneDensity).status,
    muscleStatus: deviationStatus(muscle, 100, INDICATORS.muscleMass).status,
    doseStatus: radiationStatus(dose),
  }
}

export function FutureSlider() {
  const { env, setEnvironmentId, astronaut, indicators } = useOrbit()
  const [day, setDay] = useState(400)
  const [plan, setPlan] = useState(false)
  const exerciseHistory = indicators.exercise.history
  const actualRatio =
    exerciseHistory.reduce((sum, p) => sum + p.value, 0) /
    exerciseHistory.length /
    EXERCISE_PLAN_MINUTES

  const now = project(day, env, plan, actualRatio)
  const series = useMemo(() => {
    const points = []
    for (let d = 0; d <= MAX_DAY; d += 10) {
      const off = project(d, env, false, actualRatio)
      const on = project(d, env, true, actualRatio)
      points.push({
        day: d,
        boneOff: +off.bone.toFixed(1),
        boneOn: +on.bone.toFixed(1),
        muscleOff: +off.muscle.toFixed(1),
        muscleOn: +on.muscle.toFixed(1),
        doseOff: Math.round(off.dose),
        doseOn: Math.round(on.dose),
      })
    }
    return points
  }, [env, actualRatio])

  const firstRedDay = useMemo(() => {
    for (let d = MISSION_DAY; d <= MAX_DAY; d++) {
      if (project(d, env, plan, actualRatio).boneStatus === 'act') return d
    }
    return null
  }, [env, plan, actualRatio])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Future Slider · Time machine"
        title="See where your body is heading"
        description="Drag to any mission day to project bones, muscles and radiation dose. Turn on the countermeasure plan and watch the future improve."
      />

      <section aria-labelledby="controls-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="controls-title" className="sr-only">
          Projection controls
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Projecting {astronaut.name.split(' ')[0]} to</p>
            <p className="font-mono text-4xl font-semibold">
              Day {day}
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                {day > MISSION_DAY ? `${day - MISSION_DAY} days from today` : day === MISSION_DAY ? 'today' : 'in the past'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDay(p)}
                className={cn(
                  'h-10 rounded-lg border border-input px-4 font-mono text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  day === p && 'border-primary bg-primary/15 text-primary',
                )}
              >
                Day {p}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-6 px-1">
          <Slider
            value={[day]}
            min={1}
            max={MAX_DAY}
            step={1}
            onValueChange={(v) => setDay(Array.isArray(v) ? v[0] : v)}
            aria-label="Mission day"
            className="[&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-track]]:h-2"
          />
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>Day 1</span>
            <span>Today · {MISSION_DAY}</span>
            <span>Day {MAX_DAY}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-secondary/50 p-4">
            <span className="flex items-start gap-3">
              <Dumbbell className="mt-0.5 size-5 text-primary" aria-hidden />
              <span>
                <span className="block font-medium">Follow countermeasure plan</span>
                <span className="block text-sm text-muted-foreground">
                  {plan
                    ? '150 min daily exercise, calcium + vitamin D, storm-shelter sleep'
                    : 'Off: projection assumes exercise is skipped'}
                </span>
              </span>
            </span>
            <Switch checked={plan} onCheckedChange={setPlan} aria-label="Follow countermeasure plan" />
          </label>
          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <p className="mb-2 text-sm font-medium">Environment</p>
            <div className="flex flex-wrap gap-2">
              {ENVIRONMENTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setEnvironmentId(e.id)}
                  aria-pressed={env.id === e.id}
                  className={cn(
                    'rounded-md border border-input px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary',
                    env.id === e.id && 'border-primary bg-primary/15 text-primary',
                  )}
                >
                  {e.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {env.gravityLabel} · {env.radiationPerDay} mSv/day
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section aria-labelledby="future-body" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="future-body" className="mb-2 text-lg font-semibold">
            Your twin on day {day}
          </h2>
          <BodyTwin
            linkToOrgan={false}
            statuses={{
              bones: now.boneStatus,
              muscles: now.muscleStatus,
              radiation: now.doseStatus,
              heart: 'neutral',
              brain: 'neutral',
              blood: 'neutral',
              eyes: 'neutral',
            }}
            caption="Grey points are not projected — they depend on daily readings."
          />
          <StatusLegend className="mt-4 justify-center" />
          <p
            aria-live="polite"
            className={cn(
              'mt-4 rounded-xl border p-3 text-sm',
              firstRedDay ? STATUS_STYLE.act.border : STATUS_STYLE.normal.border,
            )}
          >
            {firstRedDay
              ? `Bones turn red on day ${firstRedDay} in ${env.name.toLowerCase()} with this plan.`
              : 'Bones stay out of the red zone for the whole mission with this plan.'}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <ProjectionCard
            title="Bone density"
            value={`${now.bone.toFixed(1)}%`}
            status={now.boneStatus}
            data={series}
            day={day}
            offKey="boneOff"
            onKey="boneOn"
            plan={plan}
            domain={[(min: number) => Math.floor(min / 5) * 5, 100]}
            thresholds={[95, 90]}
          />
          <ProjectionCard
            title="Muscle mass"
            value={`${now.muscle.toFixed(1)}%`}
            status={now.muscleStatus}
            data={series}
            day={day}
            offKey="muscleOff"
            onKey="muscleOn"
            plan={plan}
            domain={[(min: number) => Math.floor(min / 5) * 5, 100]}
            thresholds={[92, 85]}
          />
          <ProjectionCard
            title="Radiation dose"
            value={`${Math.round(now.dose)} mSv`}
            status={now.doseStatus}
            data={series}
            day={day}
            offKey="doseOff"
            onKey="doseOn"
            plan={plan}
            domain={[0, (max: number) => Math.ceil(Math.max(max, RADIATION_CAREER_LIMIT) / 100) * 100]}
            thresholds={[RADIATION_CAREER_LIMIT * 0.7, RADIATION_CAREER_LIMIT]}
          />
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            bone = 100 − 1.25% × months × gravity factor × (1 − exercise effect). Rates from NASA Human
            Research Program findings; radiation from {env.source}.
          </p>
        </div>
      </div>
    </div>
  )
}

function ProjectionCard({
  title,
  value,
  status,
  data,
  day,
  offKey,
  onKey,
  plan,
  domain,
  thresholds,
}: {
  title: string
  value: string
  status: Status
  data: Record<string, number>[]
  day: number
  offKey: string
  onKey: string
  plan: boolean
  domain: [number | ((v: number) => number), number | ((v: number) => number)]
  thresholds: [number, number]
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm text-muted-foreground">{title}</h3>
          <p className={cn('font-mono text-2xl font-semibold', STATUS_STYLE[status].text)}>{value}</p>
        </div>
        <StatusPill status={status} />
      </div>
      <div className="mt-3 h-36">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[0, 900]}
              ticks={[0, 214, 400, 600, 900]}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <ReferenceLine y={thresholds[0]} stroke="var(--status-watch)" strokeDasharray="3 3" />
            <ReferenceLine y={thresholds[1]} stroke="var(--status-act)" strokeDasharray="3 3" />
            <ReferenceLine x={day} stroke="var(--primary)" strokeWidth={2} />
            <Tooltip
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => `Day ${d}`}
            />
            <Line
              type="monotone"
              dataKey={offKey}
              name="No countermeasures"
              stroke="var(--status-act)"
              strokeWidth={plan ? 1.5 : 2.5}
              strokeOpacity={plan ? 0.4 : 1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey={onKey}
              name="With plan"
              stroke="var(--status-ok)"
              strokeWidth={plan ? 2.5 : 1.5}
              strokeOpacity={plan ? 1 : 0.4}
              strokeDasharray={plan ? undefined : '4 4'}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}
