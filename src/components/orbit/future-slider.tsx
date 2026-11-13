import { useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useOrbit } from './orbit-provider'
import { EXERCISE_PLAN_MINUTES, MISSION_DAY } from '@/lib/orbit/crew'
import { ENVIRONMENTS, type MissionEnvironment } from '@/lib/orbit/environments'
import { boneDensityAt, deviationStatus, muscleMassAt, radiationAt, type Status } from '@/lib/orbit/health'
import { INDICATORS, RADIATION_CAREER_LIMIT } from '@/lib/orbit/indicators'
import { STATUS_STYLE } from '@/lib/orbit/status-style'

const MAX_DAY = 900
const PRESETS = [100, 300, 500, 900]

function radiationStatus(dose: number): Status {
  const ratio = dose / RADIATION_CAREER_LIMIT
  return ratio >= 0.9 ? 'act' : ratio >= 0.7 ? 'watch' : 'normal'
}

function project(day: number, env: MissionEnvironment, plan: boolean, actualRatio: number) {
  const futurePlan = plan ? 1 : 0
  const pastDay = Math.min(day, MISSION_DAY)
  const futureDays = Math.max(0, day - MISSION_DAY)
  const pastBone = boneDensityAt(pastDay, env, actualRatio)
  const futureBone = boneDensityAt(futureDays, env, futurePlan)
  const pastMuscle = muscleMassAt(pastDay, env, actualRatio)
  const futureMuscle = muscleMassAt(futureDays, env, futurePlan)
  const bone = pastBone - (100 - futureBone)
  const muscle = pastMuscle - (100 - futureMuscle)
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

type Point = {
  day: number
  boneOff: number
  boneOn: number
  muscleOff: number
  muscleOn: number
  doseOff: number
  doseOn: number
}

function ProjectionCard({
  title, value, status, data, day, offKey, onKey, thresholds,
}: {
  title: string
  value: string
  status: Status
  data: Point[]
  day: number
  offKey: 'boneOff' | 'muscleOff' | 'doseOff'
  onKey: 'boneOn' | 'muscleOn' | 'doseOn'
  thresholds: [number, number]
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm text-muted-foreground">{title}</h3>
          <p className={`font-mono text-2xl font-semibold ${STATUS_STYLE[status].text}`}>{value}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[status].soft} ${STATUS_STYLE[status].text}`}>
          {STATUS_STYLE[status].label}
        </span>
      </div>
      <div className="mt-4 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, left: -15, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" type="number" domain={[0, 900]} ticks={[0, 214, 400, 600, 900]} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
            <YAxis domain={offKey === 'doseOff' ? [0, 700] : [50, 105]} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
            <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8 }} labelFormatter={(v: React.ReactNode) => `Day ${v}`} />
            <ReferenceLine y={thresholds[0]} stroke="var(--status-watch)" strokeDasharray="4 4" />
            <ReferenceLine y={thresholds[1]} stroke="var(--status-act)" strokeDasharray="4 4" />
            <ReferenceLine x={day} stroke="var(--primary)" strokeWidth={2} />
            <Line dataKey={offKey} name="Without plan" stroke="var(--status-act)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey={onKey} name="With plan" stroke="var(--status-ok)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Solid: no countermeasures � Dashed: with plan</p>
    </section>
  )
}

export function FutureSlider() {
  const { env, setEnvironmentId, astronaut, indicators } = useOrbit()
  const [day, setDay] = useState(400)
  const [plan, setPlan] = useState(false)

  const history = indicators.exercise.history
  const actualRatio = history.length
    ? history.reduce((sum, point) => sum + point.value, 0) / history.length / EXERCISE_PLAN_MINUTES
    : 0

  const current = project(day, env, plan, actualRatio)

  const series = useMemo(() => {
    const points: Point[] = []
    for (let d = 0; d <= MAX_DAY; d += 10) {
      const off = project(d, env, false, actualRatio)
      const on = project(d, env, true, actualRatio)
      points.push({
        day: d,
        boneOff: Number(off.bone.toFixed(1)),
        boneOn: Number(on.bone.toFixed(1)),
        muscleOff: Number(off.muscle.toFixed(1)),
        muscleOn: Number(on.muscle.toFixed(1)),
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
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Future Slider � Time machine</p>
        <h1 className="mt-2 text-3xl font-semibold">See where your body is heading</h1>
        <p className="mt-2 text-sm text-muted-foreground">Project bones, muscles and radiation across your mission timeline.</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Projecting {astronaut.name.split(' ')[0]} to</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-3xl font-semibold">Day {day}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button key={preset} onClick={() => setDay(preset)} className={`rounded-lg border px-3 py-2 text-sm ${day === preset ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}>
                Day {preset}
              </button>
            ))}
          </div>
        </div>
        <input aria-label="Mission day" type="range" min="1" max={MAX_DAY} value={day} onChange={(e) => setDay(Number(e.target.value))} className="mt-6 w-full accent-primary" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Day 1</span><span>Today � {MISSION_DAY}</span><span>Day {MAX_DAY}</span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 p-4">
            <span>
              <span className="block font-medium">Follow countermeasure plan</span>
              <span className="text-xs text-muted-foreground">150 min daily exercise and protective measures</span>
            </span>
            <input type="checkbox" checked={plan} onChange={(e) => setPlan(e.target.checked)} className="size-5 accent-primary" />
          </label>
          <div className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="mb-3 text-sm font-medium">Mission environment</p>
            <div className="flex flex-wrap gap-2">
              {ENVIRONMENTS.map((item) => (
                <button key={item.id} onClick={() => setEnvironmentId(item.id)} aria-pressed={env.id === item.id} className={`rounded-lg border px-2 py-1.5 text-xs ${env.id === item.id ? 'border-primary bg-primary/15 text-primary' : 'border-border'}`}>
                  {item.name}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{env.gravityLabel} � {env.radiationPerDay} mSv/day</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold">Your projected status on day {day}</h2>
          <div className="mt-5 grid grid-cols-1 gap-3">
            {([
              ['Bone density', current.boneStatus, `${current.bone.toFixed(1)}%`],
              ['Muscle mass', current.muscleStatus, `${current.muscle.toFixed(1)}%`],
              ['Radiation dose', current.doseStatus, `${Math.round(current.dose)} mSv`],
            ] as [string, Status, string][]).map(([label, status, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-border p-4">
                <span className="text-sm">{label}</span>
                <span className={`font-mono font-semibold ${STATUS_STYLE[status].text}`}>{value} � {STATUS_STYLE[status].label}</span>
              </div>
            ))}
          </div>
          <p className={`mt-4 rounded-xl border p-3 text-sm ${firstRedDay ? STATUS_STYLE.act.border : STATUS_STYLE.normal.border}`}>
            {firstRedDay ? `Bone status reaches the action zone on day ${firstRedDay} under the selected plan.` : 'Bone status stays out of the action zone throughout this projection.'}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          <ProjectionCard title="Bone density" value={`${current.bone.toFixed(1)}%`} status={current.boneStatus} data={series} day={day} offKey="boneOff" onKey="boneOn" thresholds={[95, 90]} />
          <ProjectionCard title="Muscle mass" value={`${current.muscle.toFixed(1)}%`} status={current.muscleStatus} data={series} day={day} offKey="muscleOff" onKey="muscleOn" thresholds={[92, 85]} />
          <ProjectionCard title="Radiation dose" value={`${Math.round(current.dose)} mSv`} status={current.doseStatus} data={series} day={day} offKey="doseOff" onKey="doseOn" thresholds={[RADIATION_CAREER_LIMIT * 0.7, RADIATION_CAREER_LIMIT]} />
        </div>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">Projection model based on the project's health functions and selected mission environment. These are estimates, not clinical measurements.</p>
    </div>
  )
}


