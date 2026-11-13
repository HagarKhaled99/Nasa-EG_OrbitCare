/**
 * Validation: does the twin warn at the right time?
 *
 * We create many simulated astronauts (in memory only, never in the database or the sign-in list), each with a
 * different personal normal and normal day-to-day ups and downs. Some of them get a HIDDEN problem that slowly
 * gets worse (rising heart rate, falling oxygen, sleep loss, fever, rising blood pressure). Then we run the REAL
 * twin rules (`computeIndicators`, the same code the app uses) on every simulated day and count:
 *   - caught early: the twin warned BEFORE the problem reached a clinically serious level,
 *   - how many days of warning it gave (lead time),
 *   - false alarms: warnings for healthy astronauts.
 *
 * "Serious" is defined from clinical references, NOT from our own thresholds, so the test cannot pass by
 * definition: SpO₂ ≤ 92 %, fever ≥ 38.0 °C, systolic ≥ 140 mmHg, sleep ≤ 5 h, resting heart rate ≥ 25 % above
 * the astronaut's own normal.
 *
 * Everything is seeded, so the same seed always gives the same result (a judge can re-run it).
 */
import { CREW, type Astronaut } from './crew'
import { getEnvironment } from './environments'
import { computeIndicators, deviationStatus, type ReadingHistory, type Status } from './health'
import type { MeasuredIndicatorId } from './indicators'

export type ProblemKind = 'heartRate' | 'spo2' | 'sleep' | 'temperature' | 'systolic'

export const PROBLEMS: Record<
  ProblemKind,
  {
    label: string
    story: string
    /** Typical personal normal (mean, SD between people) and day-to-day SD within one person. */
    baseline: [mean: number, betweenSd: number, min: number, max: number]
    dailySd: number
    decimals: number
    /** Where the problem ends up (relative to the person's normal), and how many days it takes to get there. */
    peak: (baseline: number) => number
    rampDays: [min: number, max: number]
    serious: (value: number, baseline: number) => boolean
    seriousText: string
  }
> = {
  heartRate: {
    label: 'Resting heart rate rising',
    story: 'infection, dehydration or heart strain',
    baseline: [62, 7, 48, 80],
    dailySd: 3,
    decimals: 0,
    peak: (b) => b * 1.35,
    rampDays: [8, 16],
    serious: (v, b) => v >= b * 1.25,
    seriousText: '25 % above own normal',
  },
  spo2: {
    label: 'Blood oxygen falling',
    story: 'cabin CO₂ build-up or a lung problem',
    baseline: [97.5, 0.8, 95, 99.5],
    dailySd: 0.8,
    decimals: 0,
    peak: () => 90,
    rampDays: [6, 12],
    serious: (v) => v <= 92,
    seriousText: 'SpO₂ 92 % or lower',
  },
  sleep: {
    label: 'Sleep slowly shrinking',
    story: 'stress, workload or a broken light schedule',
    baseline: [7.2, 0.5, 6.2, 8.5],
    dailySd: 0.6,
    decimals: 1,
    peak: () => 4.5,
    rampDays: [10, 20],
    serious: (v) => v <= 5,
    seriousText: '5 hours or less',
  },
  temperature: {
    label: 'Fever starting',
    story: 'an infection',
    baseline: [36.7, 0.2, 36.2, 37.1],
    dailySd: 0.15,
    decimals: 1,
    peak: () => 38.6,
    rampDays: [3, 6],
    serious: (v) => v >= 38,
    seriousText: '38.0 °C or higher',
  },
  systolic: {
    label: 'Blood pressure rising',
    story: 'fluid shift or cardiovascular strain',
    baseline: [118, 9, 100, 132],
    dailySd: 6,
    decimals: 0,
    peak: (b) => Math.max(150, b * 1.3),
    rampDays: [10, 20],
    serious: (v) => v >= 140,
    seriousText: '140 mmHg or higher',
  },
}

export const PROBLEM_KINDS = Object.keys(PROBLEMS) as ProblemKind[]

export interface ValidationOptions {
  astronauts?: number
  days?: number
  /** Share of astronauts who get a hidden problem (0..1). */
  problemShare?: number
  /** Share of days where the watch gives no valid reading (missing data). */
  missingShare?: number
  seed?: number
  /**
   * 'app': the app's real rule (heart rate and sleep need 2 days in a row for Watch; Act fires at once).
   * 'single-day': Watch as soon as one reading is off, on every vital (the rule before this validation).
   * 'confirm-all': every vital needs 2 days in a row for Watch (tested and rejected: warns too late on fever).
   */
  rule?: WatchRule
}

export type WatchRule = 'app' | 'single-day' | 'confirm-all'

export const RULE_LABEL: Record<WatchRule, string> = {
  'single-day': 'Watch after 1 day off (all vitals)',
  'confirm-all': 'Watch after 2 days off (all vitals)',
  app: 'Our rule: 2 days for heart rate and sleep, 1 day for the rest',
}

export interface KindResult {
  kind: ProblemKind
  cases: number
  caughtEarly: number
  caughtLate: number
  missed: number
  /** Median days of warning before the problem became serious (caught-early cases only). */
  medianLeadDays: number | null
  /** Healthy astronauts: false Watch days on this vital, per astronaut per 30 days. */
  falseWatchPer30: number
}

export interface ValidationResult {
  options: Required<ValidationOptions>
  astronauts: number
  withProblem: number
  healthy: number
  /** Whole-run totals. */
  caughtEarly: number
  caughtLate: number
  missed: number
  medianLeadDays: number | null
  byKind: KindResult[]
  /** False alarms for healthy astronauts, per astronaut per 30 days. */
  falseWatchPer30: number
  falseActPer30: number
  /** Share of healthy astronauts who never got a single false Act in the whole run. */
  healthyWithoutFalseAct: number
  /** Missing readings: shown as Unknown, never as normal (should be 100 %). */
  missingShownUnknown: number
  missingDays: number
  millis: number
}

// ---------- seeded random numbers (same seed → same astronauts) ----------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(rand: () => number) {
  const u = Math.max(rand(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const median = (xs: number[]) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const ENV = getEnvironment('mars-transit')
const TEMPLATE = CREW.find((c) => c.id === 'ahmed') ?? CREW[0]

interface SimAstronaut {
  astronaut: Astronaut
  problem: { kind: ProblemKind; onset: number; seriousDay: number | null } | null
  series: Record<ProblemKind, Array<{ day: number; value: number | null }>>
}

function simulate(index: number, opts: Required<ValidationOptions>, rand: () => number): SimAstronaut {
  const baseline = { ...TEMPLATE.baseline }
  for (const kind of PROBLEM_KINDS) {
    const [mean, sd, lo, hi] = PROBLEMS[kind].baseline
    baseline[kind] = round(clamp(mean + sd * normal(rand), lo, hi), PROBLEMS[kind].decimals)
  }

  let problem: SimAstronaut['problem'] = null
  let ramp = 0
  if (rand() < opts.problemShare) {
    const kind = PROBLEM_KINDS[Math.floor(rand() * PROBLEM_KINDS.length)]
    const [rMin, rMax] = PROBLEMS[kind].rampDays
    ramp = rMin + Math.floor(rand() * (rMax - rMin + 1))
    // Start after a calm first stretch (the twin needs some normal days) and early enough to become serious.
    const onset = 10 + Math.floor(rand() * Math.max(1, opts.days - ramp - 12))
    problem = { kind, onset, seriousDay: null }
  }

  // The real (noise-free) value of the problem vital on a given day: normal, then a steady slide to the peak.
  const trueValue = (kind: ProblemKind, day: number) => {
    const b = baseline[kind]
    if (!problem || problem.kind !== kind || day < problem.onset) return b
    const progress = Math.min(1, (day - problem.onset + 1) / ramp)
    return b + (PROBLEMS[kind].peak(b) - b) * progress
  }

  const series = {} as SimAstronaut['series']
  for (const kind of PROBLEM_KINDS) {
    const def = PROBLEMS[kind]
    series[kind] = []
    for (let day = 1; day <= opts.days; day++) {
      const truth = trueValue(kind, day)
      if (problem?.kind === kind && problem.seriousDay === null && def.serious(truth, baseline[kind])) {
        problem.seriousDay = day
      }
      const missing = rand() < opts.missingShare
      let measured = truth + def.dailySd * normal(rand)
      if (kind === 'spo2') measured = Math.min(100, measured)
      series[kind].push({ day, value: missing ? null : round(measured, def.decimals) })
    }
  }

  return {
    astronaut: {
      ...TEMPLATE,
      id: `sim-${index}`,
      name: `Simulated astronaut ${index + 1}`,
      baseline,
      drift: {},
      today: {},
      crewVotes: [],
    },
    problem,
    series,
  }
}

/** Run the REAL twin rules on one simulated day: what would the astronaut see on each vital? */
function twinStatusOn(sim: SimAstronaut, day: number, rule: WatchRule): Record<ProblemKind, Status | 'unknown'> {
  const readings: ReadingHistory = {}
  for (const kind of PROBLEM_KINDS) readings[kind as MeasuredIndicatorId] = sim.series[kind].slice(Math.max(0, day - 30), day)
  const indicators = computeIndicators({
    astronaut: sim.astronaut,
    env: ENV,
    overrides: {},
    votes: [],
    readings,
    inventHistory: false,
  })
  const out = {} as Record<ProblemKind, Status | 'unknown'>
  for (const kind of PROBLEM_KINDS) {
    const ind = indicators[kind]
    const raw = deviationStatus(ind.value, ind.baseline, ind.meta).status // one day on its own
    if (!Number.isFinite(ind.value)) out[kind] = 'unknown'
    else if (rule === 'single-day') out[kind] = raw
    else if (rule === 'confirm-all') out[kind] = raw === 'watch' && ind.daysOff < 2 ? 'normal' : raw
    else out[kind] = ind.status // exactly what the astronaut sees in the app
  }
  return out
}

export function runValidation(options: ValidationOptions = {}): ValidationResult {
  const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const opts: Required<ValidationOptions> = {
    astronauts: options.astronauts ?? 1000,
    days: options.days ?? 60,
    problemShare: options.problemShare ?? 0.4,
    missingShare: options.missingShare ?? 0.05,
    seed: options.seed ?? 2026,
    rule: options.rule ?? 'app',
  }
  const rand = mulberry32(opts.seed)

  const perKind = new Map<
    ProblemKind,
    { cases: number; early: number; late: number; missed: number; leads: number[]; falseWatch: number }
  >(
    PROBLEM_KINDS.map((k) => [k, { cases: 0, early: 0, late: 0, missed: 0, leads: [], falseWatch: 0 }]),
  )
  let healthy = 0
  let falseWatchDays = 0
  let falseActDays = 0
  let healthyNoAct = 0
  let missingDays = 0
  let missingUnknown = 0

  for (let i = 0; i < opts.astronauts; i++) {
    const sim = simulate(i, opts, rand)
    let firstAlert: number | null = null
    let anyFalseAct = false

    for (let day = 1; day <= opts.days; day++) {
      const status = twinStatusOn(sim, day, opts.rule)
      for (const kind of PROBLEM_KINDS) {
        if (sim.series[kind][day - 1].value === null) {
          missingDays++
          if (status[kind] === 'unknown') missingUnknown++
        }
      }
      if (sim.problem) {
        const s = status[sim.problem.kind]
        if (firstAlert === null && day >= sim.problem.onset && (s === 'watch' || s === 'act')) firstAlert = day
      } else {
        for (const kind of PROBLEM_KINDS) if (status[kind] === 'watch') perKind.get(kind)!.falseWatch++
        const statuses = Object.values(status)
        if (statuses.includes('act')) {
          falseActDays++
          anyFalseAct = true
        } else if (statuses.includes('watch')) falseWatchDays++
      }
    }

    if (sim.problem) {
      const k = perKind.get(sim.problem.kind)!
      k.cases++
      const serious = sim.problem.seriousDay ?? opts.days + 1
      if (firstAlert !== null && firstAlert < serious) {
        k.early++
        k.leads.push(serious - firstAlert)
      } else if (firstAlert !== null) k.late++
      else k.missed++
    } else {
      healthy++
      if (!anyFalseAct) healthyNoAct++
    }
  }

  const healthyDays = healthy * opts.days
  const byKind: KindResult[] = PROBLEM_KINDS.map((kind) => {
    const k = perKind.get(kind)!
    return {
      kind,
      cases: k.cases,
      caughtEarly: k.early,
      caughtLate: k.late,
      missed: k.missed,
      medianLeadDays: median(k.leads),
      falseWatchPer30: healthyDays ? (k.falseWatch / healthyDays) * 30 : 0,
    }
  })
  const allLeads = PROBLEM_KINDS.flatMap((k) => perKind.get(k)!.leads)
  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()

  return {
    options: opts,
    astronauts: opts.astronauts,
    withProblem: opts.astronauts - healthy,
    healthy,
    caughtEarly: byKind.reduce((s, k) => s + k.caughtEarly, 0),
    caughtLate: byKind.reduce((s, k) => s + k.caughtLate, 0),
    missed: byKind.reduce((s, k) => s + k.missed, 0),
    medianLeadDays: median(allLeads),
    byKind,
    falseWatchPer30: healthyDays ? (falseWatchDays / healthyDays) * 30 : 0,
    falseActPer30: healthyDays ? (falseActDays / healthyDays) * 30 : 0,
    healthyWithoutFalseAct: healthy ? healthyNoAct / healthy : 1,
    missingShownUnknown: missingDays ? missingUnknown / missingDays : 1,
    missingDays,
    millis: Math.round(ended - started),
  }
}
