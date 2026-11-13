import {
  EXERCISE_PLAN_MINUTES,
  HISTORY_DAYS,
  MISSION_DAY,
  type Astronaut,
  type CrewVote,
} from './crew'
import { gravityFactor, isDeepSpace, type MissionEnvironment } from './environments'
import {
  INDICATORS,
  RADIATION_CAREER_LIMIT,
  type IndicatorId,
  type IndicatorMeta,
  type MeasuredIndicatorId,
} from './indicators'
import { ORGANS, type OrganDef } from './organs'

export type Status = 'normal' | 'watch' | 'act'

export const STATUS_RANK: Record<Status, number> = { normal: 0, watch: 1, act: 2 }

export function worstStatus(statuses: Status[]): Status {
  return statuses.reduce<Status>(
    (worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst),
    'normal',
  )
}

export interface Point {
  day: number
  value: number
}

export interface IndicatorState {
  id: IndicatorId
  meta: IndicatorMeta
  value: number
  baseline: number
  deviation: number
  status: Status
  history: Point[]
  daysOff: number
  message: string
}

function noise(seed: number, day: number) {
  const x = Math.sin(seed * 12.9898 + day * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

const NOISE_AMPLITUDE: Partial<Record<MeasuredIndicatorId, number>> = {
  temperature: 0.004,
  spo2: 0.006,
  mood: 0.12,
  vision: 0,
  exercise: 0.04,
  sleep: 0.05,
}

function roundTo(value: number, decimals: number) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

export function measuredHistory(
  astronaut: Astronaut,
  id: MeasuredIndicatorId,
  todayOverride?: number,
): Point[] {
  const meta = INDICATORS[id]
  const baseline = astronaut.baseline[id]
  const drift = astronaut.drift[id]
  const amp = NOISE_AMPLITUDE[id] ?? 0.03
  const points: Point[] = []
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const day = MISSION_DAY - i
    let value = baseline * (1 + amp * noise(astronaut.seed + id.length, day))
    if (drift && i < drift.days) {
      const ramp = (drift.days - i) / drift.days
      value = baseline * (1 + drift.pct * (0.6 + 0.4 * ramp)) * (1 + amp * 0.3 * noise(astronaut.seed, day))
    }
    if (id === 'mood') value = Math.min(5, Math.max(1, value))
    if (id === 'vision') value = Math.min(10, value)
    if (id === 'spo2') value = Math.min(100, value)
    points.push({ day, value: roundTo(value, meta.decimals) })
  }
  const today = todayOverride ?? astronaut.today[id]
  if (today !== undefined) points[points.length - 1] = { day: MISSION_DAY, value: today }
  return points
}

const BONE_MONTHLY_LOSS = 1.25
const MUSCLE_MONTHLY_LOSS = 1.5

export function boneDensityAt(day: number, env: MissionEnvironment, exerciseRatio: number) {
  const months = day / 30.4
  const effect = 0.75 * Math.min(1, Math.max(0, exerciseRatio))
  return 100 - BONE_MONTHLY_LOSS * months * gravityFactor(env) * (1 - effect)
}

export function muscleMassAt(day: number, env: MissionEnvironment, exerciseRatio: number) {
  const months = day / 30.4
  const effect = 0.8 * Math.min(1, Math.max(0, exerciseRatio))
  return 100 - MUSCLE_MONTHLY_LOSS * months * gravityFactor(env) * (1 - effect)
}

export function radiationAt(day: number, env: MissionEnvironment, shelterPlan = false) {
  return day * env.radiationPerDay * (shelterPlan ? 0.88 : 1)
}

export function deviationStatus(value: number, baseline: number, meta: IndicatorMeta) {
  const deviation = baseline === 0 ? 0 : (value - baseline) / baseline
  let directional = Math.abs(deviation)
  if (meta.bad === 'low' && deviation > 0) directional = 0
  if (meta.bad === 'high' && deviation < 0) directional = 0
  let status: Status = 'normal'
  if (directional >= meta.actPct) status = 'act'
  else if (directional >= meta.watchPct) status = 'watch'
  if (meta.hardMin !== undefined && value < meta.hardMin) status = 'act'
  if (meta.hardMax !== undefined && value > meta.hardMax) status = 'act'
  return { deviation, status }
}

function radiationStatus(dose: number): Status {
  const fraction = dose / RADIATION_CAREER_LIMIT
  if (fraction >= 0.9) return 'act'
  if (fraction >= 0.7) return 'watch'
  return 'normal'
}

export function crewPulseStatus(flags: number): Status {
  if (flags >= 3) return 'act'
  if (flags >= 2) return 'watch'
  return 'normal'
}

function countDaysOff(history: Point[], baseline: number, meta: IndicatorMeta) {
  let count = 0
  for (let i = history.length - 1; i >= 0; i--) {
    if (deviationStatus(history[i].value, baseline, meta).status === 'normal') break
    count++
  }
  return count
}

function describe(meta: IndicatorMeta, deviation: number, status: Status, daysOff: number) {
  if (status === 'normal') return 'Within your personal normal range.'
  const pct = Math.round(Math.abs(deviation) * 100)
  const direction = deviation > 0 ? 'above' : 'below'
  const duration = daysOff > 1 ? ` for ${daysOff} days` : ' today'
  return `${pct}% ${direction} your normal${duration}.`
}

export interface TwinInput {
  astronaut: Astronaut
  env: MissionEnvironment
  overrides: Partial<Record<MeasuredIndicatorId, number>>
  votes: CrewVote[]
}

export function computeIndicators(input: TwinInput): Record<IndicatorId, IndicatorState> {
  const { astronaut, env, overrides, votes } = input
  const result = {} as Record<IndicatorId, IndicatorState>
  const measuredIds = Object.keys(astronaut.baseline) as MeasuredIndicatorId[]

  for (const id of measuredIds) {
    const meta = INDICATORS[id]
    const baseline = astronaut.baseline[id]
    const history = measuredHistory(astronaut, id, overrides[id])
    const value = history[history.length - 1].value
    const { deviation, status } = deviationStatus(value, baseline, meta)
    const daysOff = countDaysOff(history, baseline, meta)
    result[id] = {
      id,
      meta,
      value,
      baseline,
      deviation,
      status,
      history,
      daysOff,
      message: describe(meta, deviation, status, daysOff),
    }
  }

  const exerciseHistory = result.exercise.history
  const avgExercise =
    exerciseHistory.reduce((sum, p) => sum + p.value, 0) / exerciseHistory.length
  const exerciseRatio = avgExercise / EXERCISE_PLAN_MINUTES

  const computedSeries: Array<[IndicatorId, (day: number) => number]> = [
    ['boneDensity', (day) => boneDensityAt(day, env, exerciseRatio)],
    ['muscleMass', (day) => muscleMassAt(day, env, exerciseRatio)],
  ]
  for (const [id, fn] of computedSeries) {
    const meta = INDICATORS[id]
    const history = exerciseHistory.map((p) => ({ day: p.day, value: roundTo(fn(p.day), 1) }))
    const value = history[history.length - 1].value
    const { deviation, status } = deviationStatus(value, 100, meta)
    result[id] = {
      id,
      meta,
      value,
      baseline: 100,
      deviation,
      status,
      history,
      daysOff: 0,
      message:
        status === 'normal'
          ? `Projected ${Math.abs(roundTo(deviation * 100, 1))}% below pre-flight — within the safe range.`
          : `Projected ${Math.abs(roundTo(deviation * 100, 1))}% below your pre-flight scan.`,
    }
  }

  const doseHistory = exerciseHistory.map((p) => ({
    day: p.day,
    value: Math.round(radiationAt(p.day, env)),
  }))
  const dose = doseHistory[doseHistory.length - 1].value
  const doseStatus = radiationStatus(dose)
  result.radiationDose = {
    id: 'radiationDose',
    meta: INDICATORS.radiationDose,
    value: dose,
    baseline: RADIATION_CAREER_LIMIT,
    deviation: dose / RADIATION_CAREER_LIMIT,
    status: doseStatus,
    history: doseHistory,
    daysOff: 0,
    message: `${Math.round((dose / RADIATION_CAREER_LIMIT) * 100)}% of your 600 mSv career limit.`,
  }

  const flags = votes.filter((v) => !v.seemsLikeThemselves).length
  const pulseStatus = crewPulseStatus(flags)
  const selfMood = result.mood.value
  const mismatch = flags >= 2 && selfMood >= 4
  result.crewPulse = {
    id: 'crewPulse',
    meta: INDICATORS.crewPulse,
    value: flags,
    baseline: 0,
    deviation: flags / Math.max(1, votes.length),
    status: pulseStatus,
    history: exerciseHistory.slice(-7).map((p, i, arr) => ({
      day: p.day,
      value: i === arr.length - 1 ? flags : i >= arr.length - 3 ? Math.max(0, flags - 1) : 0,
    })),
    daysOff: 0,
    message: mismatch
      ? `You report feeling fine, but ${flags} of ${votes.length} crewmates feel you are not quite yourself.`
      : flags === 0
        ? 'Your crew says you seem like yourself.'
        : `${flags} of ${votes.length} crewmates flagged a change today.`,
  }

  return result
}

export interface OrganState {
  organ: OrganDef
  status: Status
  indicators: IndicatorState[]
}

export function computeOrgans(indicators: Record<IndicatorId, IndicatorState>): OrganState[] {
  return ORGANS.map((organ) => {
    const states = organ.indicators.map((id) => indicators[id])
    return { organ, status: worstStatus(states.map((s) => s.status)), indicators: states }
  })
}

export function readinessScore(organs: OrganState[], checkedInToday: boolean) {
  let score = 100
  for (const o of organs) {
    if (o.status === 'watch') score -= 9
    if (o.status === 'act') score -= 22
  }
  if (!checkedInToday) score -= 4
  return Math.max(0, Math.min(100, score))
}

export interface Routing {
  title: string
  detail: string
  contact: string
}

export function getRouting(status: Status, env: MissionEnvironment): Routing {
  const deep = isDeepSpace(env)
  if (status === 'normal') {
    return {
      title: 'Self-care',
      detail: 'Follow the guidance below. No one needs to be contacted.',
      contact: 'You',
    }
  }
  if (status === 'watch') {
    return deep
      ? {
          title: 'Crew medical officer handles it on board',
          detail:
            'Earth is too far for a live conversation. Your crew medical officer reviews this today and decides next steps.',
          contact: 'Crew medical officer',
        }
      : {
          title: 'Message the flight surgeon',
          detail:
            'Send a short note to your flight surgeon. With near real-time contact you will usually get an answer within the hour.',
          contact: 'Flight surgeon',
        }
  }
  return deep
    ? {
        title: 'Follow onboard protocol now',
        detail:
          'Act immediately with the crew medical officer. A Medical Report Packet is generated and sent to Earth so the flight surgeons can follow up.',
        contact: 'Crew medical officer + Earth (report packet)',
      }
    : {
        title: 'Contact ground immediately',
        detail:
          'Call the flight surgeon on the private medical channel now. Prepare the Medical Report Packet for them.',
        contact: 'Flight surgeon (live)',
      }
}
