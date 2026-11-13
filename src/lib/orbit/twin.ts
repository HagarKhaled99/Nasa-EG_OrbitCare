/**
 * Twin View logic (Member 2, Omar). Ported from the member2-twin-view branch into the Vite app.
 *
 * Pure, framework-free functions that turn the shared health state into the
 * snapshot the home screen renders. The same code runs in the browser (live,
 * from OrbitProvider) and on the server (GET /api/twin), so the page and the
 * API can never disagree.
 *
 * Safety rules enforced here:
 *  - A body system with missing data is 'unknown'. It is never shown as 'normal'.
 *  - Distance from Earth changes WHO you contact, never how serious a reading is.
 */
import { EXERCISE_PLAN_MINUTES, MISSION_DAY, MISSION_NAME, type Astronaut } from './crew'
import {
  ENVIRONMENTS,
  formatDelay,
  getEnvironment,
  isDeepSpace,
  type EnvironmentId,
  type MissionEnvironment,
} from './environments'
import {
  boneDensityAt,
  computeIndicators,
  computeOrgans,
  getRouting,
  muscleMassAt,
  radiationAt,
  readinessScore,
  worstStatus,
  type IndicatorState,
  type OrganState,
  type Point,
  type Routing,
  type Status,
} from './health'
import { RADIATION_CAREER_LIMIT, type IndicatorId } from './indicators'
import type { OrganId } from './organs'
import { WATCH_SYNC } from './sensors'
import { symptomLevels, type SymptomId } from './symptoms'

export type TwinStatus = Status | 'unknown'

export const TWIN_STATUS_RANK: Record<TwinStatus, number> = { normal: 0, unknown: 1, watch: 2, act: 3 }

/** Label every payload so demo values can never be mistaken for real astronaut data. */
export const DATA_LABEL = 'SYNTHETIC_DEMO' as const

// ---------------------------------------------------------------------------
// NASA reference material: the five spaceflight hazards, "RIDGE" (NASA HRP).
// These pages are educational references, not measurement datasets.
// ---------------------------------------------------------------------------

export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'hostile'

export interface Hazard {
  id: HazardId
  letter: 'R' | 'I' | 'D' | 'G' | 'E'
  name: string
  plain: string
  sourceUrl: string
}

export const HRP_HAZARDS_URL = 'https://www.nasa.gov/hrp/hazards/'

export const HAZARDS: Hazard[] = [
  {
    id: 'radiation',
    letter: 'R',
    name: 'Radiation',
    plain: 'Outside Earth’s magnetic field, dose is higher and adds up over the mission.',
    sourceUrl: HRP_HAZARDS_URL,
  },
  {
    id: 'isolation',
    letter: 'I',
    name: 'Isolation',
    plain: 'Months in a small cabin with the same people affect sleep, mood and teamwork.',
    sourceUrl: HRP_HAZARDS_URL,
  },
  {
    id: 'distance',
    letter: 'D',
    name: 'Distance',
    plain: 'The farther from Earth, the longer every message takes, so more is handled on board.',
    sourceUrl: HRP_HAZARDS_URL,
  },
  {
    id: 'gravity',
    letter: 'G',
    name: 'Gravity',
    plain: 'Low gravity shifts body fluids toward the head and weakens bones and muscles.',
    sourceUrl: HRP_HAZARDS_URL,
  },
  {
    id: 'hostile',
    letter: 'E',
    name: 'Environment',
    plain: 'A sealed cabin shapes the air, noise, light and germs your immune system meets.',
    sourceUrl: HRP_HAZARDS_URL,
  },
]

export const REFERENCES = [
  { label: 'NASA HRP · Hazards', url: HRP_HAZARDS_URL },
  { label: 'NASA HRP · Risks', url: 'https://www.nasa.gov/hrp/risks/' },
  { label: 'NASA HRP · Ongoing research', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' },
  {
    label: 'CSA · Monitoring radiation and astronaut health (26 Feb 2026)',
    url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  {
    label: 'CSA · Why do we conduct science experiments in space?',
    url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp',
  },
] as const

/** Map an organ's free-text hazard label onto the RIDGE hazards. */
export function hazardsFor(label: string): HazardId[] {
  const l = label.toLowerCase()
  const ids: HazardId[] = []
  if (l.includes('radiation')) ids.push('radiation')
  if (l.includes('isolation') || l.includes('confinement')) ids.push('isolation')
  if (l.includes('gravity')) ids.push('gravity')
  if (l.includes('closed') || l.includes('hostile')) ids.push('hostile')
  return ids
}

// ---------------------------------------------------------------------------
// Data sources: where each number on the twin comes from.
// Blood pressure is a manual cuff, radiation is a separate dosimeter, and
// bone/muscle are model estimates. None of these are claimed for the watch.
// ---------------------------------------------------------------------------

export type DataSourceId = 'watch' | 'meter' | 'dosimeter' | 'cuff' | 'thermometer' | 'self' | 'crew' | 'model'

export const DATA_SOURCES: Record<DataSourceId, { label: string; detail: string; simulated: boolean }> = {
  watch: {
    label: 'Watch',
    detail: 'Simulated wearable: heart rate, SpO₂ (proposed optical sensor), sleep, activity',
    simulated: true,
  },
  meter: { label: 'Glucose meter', detail: 'Fingerstick glucose meter, entered at check-in', simulated: false },
  dosimeter: { label: 'Dosimeter', detail: 'Simulated personal dosimeter, separate from the watch', simulated: true },
  cuff: { label: 'BP cuff', detail: 'Manual blood-pressure cuff, entered at check-in', simulated: false },
  thermometer: { label: 'Thermometer', detail: 'Separate thermometer, entered at check-in', simulated: false },
  self: { label: 'Self-test', detail: 'Mood, grip and vision checks you do yourself', simulated: false },
  crew: { label: 'Crew Pulse', detail: 'Daily private answers from your crewmates', simulated: false },
  model: { label: 'Twin model', detail: 'Estimate from mission days, gravity and exercise. Not a scan.', simulated: true },
}

export const INDICATOR_SOURCE: Record<IndicatorId, DataSourceId> = {
  heartRate: 'watch',
  spo2: 'watch',
  sleep: 'watch',
  exercise: 'watch',
  systolic: 'cuff',
  diastolic: 'cuff',
  temperature: 'thermometer',
  glucose: 'meter',
  mood: 'self',
  grip: 'self',
  vision: 'self',
  boneDensity: 'model',
  muscleMass: 'model',
  radiationDose: 'dosimeter',
  crewPulse: 'crew',
}

/** Sources that only update when the astronaut does a check-in. */
const CHECK_IN_SOURCES: DataSourceId[] = ['cuff', 'thermometer', 'meter', 'self']

/** Sources compared against a baseline (the astronaut's own, or 100% pre-flight for the model). */
const BASELINE_SOURCES: DataSourceId[] = ['watch', 'meter', 'cuff', 'thermometer', 'self', 'model']

// ---------------------------------------------------------------------------
// Environments: what each place does to the body and to communication.
// Delay, gravity and radiation come from environments.ts; bone and muscle use
// the same illustrative model as the Future Slider. Not clinical predictions.
// ---------------------------------------------------------------------------

/** Extra facts per environment (illustrative, for the demo). */
const ENV_FACTS: Record<EnvironmentId, { dayCycle: string; returnToEarth: string }> = {
  iss: { dayCycle: '16 sunrises a day', returnToEarth: 'About 1 day' },
  'lunar-orbit': { dayCycle: 'Light follows a 6.5-day orbit', returnToEarth: 'About 5 days' },
  'moon-base': { dayCycle: 'About 2 weeks light, 2 weeks dark', returnToEarth: 'About 5 days' },
  'mars-transit': { dayCycle: 'No sunrise: constant sunlight', returnToEarth: 'Months. No early return' },
  'mars-base': { dayCycle: '1 sol = 24 h 39 min', returnToEarth: 'Months, at the next launch window' },
  'mars-rover': { dayCycle: '1 sol = 24 h 39 min', returnToEarth: 'Back to base first, then months' },
}

export interface EnvironmentEffects {
  id: EnvironmentId
  name: string
  kind: MissionEnvironment['kind']
  gravity: number
  gravityLabel: string
  earthDelaySeconds: number
  earthDelayLabel: string
  roundTripLabel: string
  deepSpace: boolean
  radiationPerDay: number
  /** Dose over the next 30 days at this location (mSv). */
  dose30Days: number
  /** Estimated bone loss per month with your current exercise (%). */
  boneLossPerMonth: number
  /** Estimated muscle loss per month with your current exercise (%). */
  muscleLossPerMonth: number
  /** Bone loss per month with no exercise at all (%), for comparison. */
  boneLossNoExercise: number
  dayCycle: string
  returnToEarth: string
  /** Who you contact first for a Watch or an Act alert here. */
  contactWatch: string
  contactAct: string
  source: string
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d

/** Share of the exercise plan this astronaut has been doing (0 to 1+), from the last 30 days. */
export function exerciseRatioFrom(indicators: Record<IndicatorId, IndicatorState>) {
  const history = indicators.exercise?.history ?? []
  if (history.length === 0) return 0
  return history.reduce((sum, p) => sum + p.value, 0) / history.length / EXERCISE_PLAN_MINUTES
}

export function environmentEffects(env: MissionEnvironment, exerciseRatio: number): EnvironmentEffects {
  const month = 30.4
  const facts = ENV_FACTS[env.id]
  return {
    id: env.id,
    name: env.name,
    kind: env.kind,
    gravity: env.gravity,
    gravityLabel: env.gravityLabel,
    earthDelaySeconds: env.delaySeconds,
    earthDelayLabel: formatDelay(env.delaySeconds),
    roundTripLabel: formatDelay(env.delaySeconds * 2),
    deepSpace: isDeepSpace(env),
    radiationPerDay: env.radiationPerDay,
    dose30Days: round(radiationAt(30, env), 1),
    boneLossPerMonth: round(100 - boneDensityAt(month, env, exerciseRatio)),
    muscleLossPerMonth: round(100 - muscleMassAt(month, env, exerciseRatio)),
    boneLossNoExercise: round(100 - boneDensityAt(month, env, 0)),
    dayCycle: facts.dayCycle,
    returnToEarth: facts.returnToEarth,
    contactWatch: getRouting('watch', env).contact,
    contactAct: getRouting('act', env).contact,
    source: env.source,
  }
}

/** Effects of every environment for one astronaut's exercise level (used by /api/environments). */
export function allEnvironmentEffects(exerciseRatio: number) {
  return ENVIRONMENTS.map((env) => environmentEffects(env, exerciseRatio))
}

// ---------------------------------------------------------------------------
// Body figures: hotspot positions tuned for each body image.
// organs.ts holds the default positions (they match the female figure).
// ---------------------------------------------------------------------------

const FIGURE_POSITION: Record<Astronaut['figure'], Partial<Record<OrganId, { x: number; y: number }>>> = {
  female: {},
  male: { brain: { x: 50, y: 6.2 }, eyes: { x: 50, y: 10.6 }, muscles: { x: 34, y: 27.5 } },
}

// ---------------------------------------------------------------------------
// Earth-Independent Mode: comms windows and the Mars solar-conjunction blackout.
// NASA facts (sources in CONJUNCTION_SOURCES):
//  - Mars solar conjunction happens about every 2 years.
//  - The Sun's hot, ionized gas can corrupt radio signals, so NASA pauses all
//    commands to Mars for about two weeks (Nov 11-25, 2023; Aug 28-Sep 7, 2019).
//  - For about 2 days Mars is fully behind the Sun and there is no contact at all.
// The mission-day dates below are a DEMO SCENARIO (this mission is fictional);
// the length matches NASA's 2023 two-week pause.
// ---------------------------------------------------------------------------

export type CommsState = 'reachable' | 'pre-blackout' | 'blackout'

/** Demo scenario: blackout from mission day 220 for 14 days (NASA's 2023 pause was 14 days). */
export const CONJUNCTION_DEMO = { startDay: 220, lengthDays: 14 }

/** NASA pages the conjunction facts come from. */
export const CONJUNCTION_SOURCES = [
  {
    label: 'NASA · What is Mars solar conjunction?',
    url: 'https://www.nasa.gov/solar-system/whats-mars-solar-conjunction-and-why-does-it-matter/',
  },
  {
    label: 'NASA JPL · Mars fleet lies low (Nov 11-25, 2023)',
    url: 'https://www.jpl.nasa.gov/news/nasas-mars-fleet-will-still-conduct-science-while-lying-low/',
  },
] as const
/** Start warning the crew this many days before the blackout. */
const PREP_DAYS = 7
const CONJUNCTION_ENVS: EnvironmentId[] = ['mars-transit', 'mars-base', 'mars-rover']

const ALWAYS_IN_VIEW: Partial<Record<EnvironmentId, string>> = {
  iss: 'Relay satellites keep the ISS in contact with Earth almost all the time.',
  'lunar-orbit': 'Only short gaps when Gateway passes behind the Moon.',
  'moon-base': 'Earth stays in the sky over the near side of the Moon.',
}

export interface CommsWindow {
  state: CommsState
  /** True where a solar-conjunction blackout can happen (Mars). */
  hasConjunction: boolean
  /** True when the demo button forced the blackout. */
  demo: boolean
  blackoutStartDay: number | null
  blackoutEndDay: number | null
  daysUntilBlackout: number | null
  daysUntilRestored: number | null
  title: string
  detail: string
  /** What to do before the blackout starts (only before it). */
  prepAdvice: string | null
  /** What the flight surgeon on Earth can see right now. */
  earthSees: string
}

export function commsWindow(
  env: MissionEnvironment,
  missionDay: number,
  flaggedSystems: string[],
  forceBlackout = false,
): CommsWindow {
  const delay = formatDelay(env.delaySeconds)
  const hasConjunction = CONJUNCTION_ENVS.includes(env.id)

  if (!hasConjunction) {
    return {
      state: 'reachable',
      hasConjunction,
      demo: false,
      blackoutStartDay: null,
      blackoutEndDay: null,
      daysUntilBlackout: null,
      daysUntilRestored: null,
      title: 'Earth is in contact',
      detail: ALWAYS_IN_VIEW[env.id] ?? 'No long blackout is expected here.',
      prepAdvice: null,
      earthSees: `Your data, ${delay} behind you`,
    }
  }

  const start = forceBlackout ? missionDay : CONJUNCTION_DEMO.startDay
  const end = start + CONJUNCTION_DEMO.lengthDays
  const inBlackout = missionDay >= start && missionDay < end

  if (inBlackout) {
    const daysLeft = end - missionDay
    return {
      state: 'blackout',
      hasConjunction,
      demo: forceBlackout,
      blackoutStartDay: start,
      blackoutEndDay: end,
      daysUntilBlackout: 0,
      daysUntilRestored: daysLeft,
      title: `No reliable contact with Earth · back in ${daysLeft} days`,
      detail:
        "The Sun is between Earth and Mars. Its hot gas scrambles radio signals, so messages can't be trusted, and for about 2 days there is no signal at all. Your twin keeps watching, you follow the onboard protocol with your crew medical officer, and reports wait for Earth.",
      prepAdvice: null,
      earthSees: `Nothing reliable until day ${end}. Reports are queued.`,
    }
  }

  const daysUntil = start - missionDay
  const soon = daysUntil > 0 && daysUntil <= PREP_DAYS
  const list = flaggedSystems.join(' and ').toLowerCase()
  return {
    state: soon ? 'pre-blackout' : 'reachable',
    hasConjunction,
    demo: false,
    blackoutStartDay: start,
    blackoutEndDay: end,
    daysUntilBlackout: daysUntil,
    daysUntilRestored: null,
    title: soon ? `Blackout in ${daysUntil} days` : 'Earth is in contact',
    detail: soon
      ? `From day ${start} to day ${end} the Sun will scramble contact with Earth for ${CONJUNCTION_DEMO.lengthDays} days, like NASA's two-week pause in November 2023.`
      : `Messages take ${delay} each way.`,
    prepAdvice: soon
      ? flaggedSystems.length > 0
        ? `Talk to the flight surgeon about your ${list} in the next ${daysUntil} days, while Earth can still answer.`
        : `Send any questions for the flight surgeon in the next ${daysUntil} days, while Earth can still answer.`
      : null,
    earthSees: `Your data, ${delay} behind you`,
  }
}

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

/** How the readout strip should draw this value. */
export type MeterKind = 'baseline' | 'budget' | 'votes'

export interface TwinIndicatorSummary {
  id: IndicatorId
  label: string
  value: number | null
  /** Personal pre-flight normal (null for dosimeter / crew values). */
  baseline: number | null
  /** Baseline meter: signed fraction from normal (0.18 = 18% above). Budget meter: fraction of the limit used. */
  deviation: number | null
  unit: string
  decimals: number
  status: TwinStatus
  message: string
  source: DataSourceId
  freshness: 'today' | 'earlier'
  meter: MeterKind
  /** Which direction is a problem. */
  bad: 'low' | 'high' | 'both'
  watchPct: number
  actPct: number
  /** Up to 30 days of values for the trend line. */
  history: Point[]
}

export interface TwinOrganCard {
  id: OrganId
  name: string
  shortName: string
  href: string
  status: TwinStatus
  hazardLabel: string
  hazards: HazardId[]
  lead: TwinIndicatorSummary
  indicators: TwinIndicatorSummary[]
  sources: DataSourceId[]
  unknownCount: number
  nextStep: string
  /** Symptoms reported today for this system (self-report). */
  symptoms: string[]
  position: { x: number; y: number }
}

export interface MissionProfile {
  missionName: string
  missionDay: number
  environmentId: EnvironmentId
  environmentName: string
  vehicleKind: MissionEnvironment['kind']
  gravityLabel: string
  earthDelaySeconds: number
  earthDelayLabel: string
  roundTripLabel: string
  deepSpace: boolean
  radiationPerDay: number
  radiationBudgetPct: number
  environmentSource: string
  effects: EnvironmentEffects
}

export interface TwinSnapshot {
  dataLabel: typeof DATA_LABEL
  generatedAt: string
  astronaut: {
    id: string
    name: string
    firstName: string
    role: string
    initials: string
    figure: Astronaut['figure']
  }
  overall: TwinStatus
  headline: string
  subline: string
  pitch: string
  readiness: number
  counts: Record<TwinStatus, number>
  organs: TwinOrganCard[]
  hotspots: Record<OrganId, TwinStatus>
  activeHazards: HazardId[]
  mission: MissionProfile
  routing: Routing
  /** Who is contacted, in order, for the current status, distance and comms window. */
  contactChain: string[]
  /** Earth-Independent Mode: can Earth be reached, and when is the next blackout. */
  comms: CommsWindow
  lastUpdate: {
    checkedInToday: boolean
    lastCheckIn: string
    watchLastSync: string
    watchBattery: number
  }
  sourcesInUse: DataSourceId[]
}

// ---------------------------------------------------------------------------
// Status rules
// ---------------------------------------------------------------------------

export function indicatorTwinStatus(state: IndicatorState | undefined): TwinStatus {
  if (!state || !Number.isFinite(state.value)) return 'unknown'
  return state.status
}

/**
 * Worst known status wins. If everything we can see is normal but one or more
 * readings are missing, the system is 'unknown'. We cannot call it normal.
 */
export function organTwinStatus(statuses: TwinStatus[]): TwinStatus {
  const known = statuses.filter((s): s is Status => s !== 'unknown')
  if (known.length === 0) return 'unknown'
  const worst = worstStatus(known)
  if (worst === 'normal' && known.length < statuses.length) return 'unknown'
  return worst
}

export function worstTwinStatus(statuses: TwinStatus[]): TwinStatus {
  return statuses.reduce<TwinStatus>((w, s) => (TWIN_STATUS_RANK[s] > TWIN_STATUS_RANK[w] ? s : w), 'normal')
}

function meterFor(id: IndicatorId): MeterKind {
  if (id === 'radiationDose') return 'budget'
  if (id === 'crewPulse') return 'votes'
  return 'baseline'
}

function summarize(
  state: IndicatorState | undefined,
  id: IndicatorId,
  astronaut: Astronaut,
  checkedInToday: boolean,
): TwinIndicatorSummary {
  const source = INDICATOR_SOURCE[id]
  const status = indicatorTwinStatus(state)
  const known = status !== 'unknown' && state !== undefined
  const meter = meterFor(id)
  const readToday =
    !CHECK_IN_SOURCES.includes(source) ||
    checkedInToday ||
    (astronaut.today as Partial<Record<IndicatorId, number>>)[id] !== undefined

  let deviation: number | null = null
  if (known && meter === 'baseline') deviation = state.deviation
  if (known && meter === 'budget') deviation = state.value / RADIATION_CAREER_LIMIT

  return {
    id,
    label: state?.meta.label ?? id,
    value: known ? state.value : null,
    baseline: known && BASELINE_SOURCES.includes(source) ? state.baseline : null,
    deviation,
    unit: state?.meta.unit ?? '',
    decimals: state?.meta.decimals ?? 0,
    status,
    message: known ? state.message : 'No valid reading. Measure again.',
    source,
    freshness: readToday ? 'today' : 'earlier',
    meter,
    bad: state?.meta.bad ?? 'both',
    watchPct: state?.meta.watchPct ?? 0.1,
    actPct: state?.meta.actPct ?? 0.2,
    history: known ? state.history.filter((p) => Number.isFinite(p.value)) : [],
  }
}

function chainFor(status: TwinStatus, deep: boolean, blackout: CommsWindow | null = null): string[] {
  if (blackout) {
    // No Earth contact: same seriousness, but everything is handled on board.
    if (status === 'act') return ['You', 'Crew medical officer', `Earth · queued until day ${blackout.blackoutEndDay}`]
    if (status === 'watch') return ['You', 'Crew medical officer']
    if (status === 'unknown') return ['You', 'Repeat the measurement']
    return ['You', 'Self-care']
  }
  if (status === 'act') return deep ? ['You', 'Crew medical officer', 'Earth · report packet'] : ['You', 'Flight surgeon · live call']
  if (status === 'watch') return deep ? ['You', 'Crew medical officer'] : ['You', 'Flight surgeon · message']
  if (status === 'unknown') return ['You', 'Repeat the measurement']
  return ['You', 'Self-care']
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

export interface TwinInputs {
  astronaut: Astronaut
  env: MissionEnvironment
  indicators: Record<IndicatorId, IndicatorState>
  organs: OrganState[]
  readiness: number
  checkedInToday: boolean
  now?: Date
  /** Demo button: pretend the Mars blackout has started today. */
  forceBlackout?: boolean
  /** Symptoms reported at today's check-in. Urgent ones raise Act even when the numbers look normal (plan §7). */
  symptoms?: SymptomId[]
}

export function buildTwinSnapshot(input: TwinInputs): TwinSnapshot {
  const { astronaut, env, indicators, organs, readiness, checkedInToday } = input

  const reported = symptomLevels(input.symptoms ?? [])
  const cards: TwinOrganCard[] = organs.map(({ organ }) => {
    const summaries = organ.indicators.map((id) => summarize(indicators[id], id, astronaut, checkedInToday))
    const symptom = reported[organ.id]
    const measured = organTwinStatus(summaries.map((s) => s.status))
    const status = symptom ? worstTwinStatus([measured, symptom.level]) : measured
    const lead = [...summaries].sort((a, b) => TWIN_STATUS_RANK[b.status] - TWIN_STATUS_RANK[a.status])[0]
    return {
      id: organ.id,
      name: organ.name,
      shortName: organ.shortName,
      href: `/organ/${organ.id}`,
      status,
      hazardLabel: organ.hazard,
      hazards: hazardsFor(organ.hazard),
      lead,
      indicators: summaries,
      sources: [...new Set(summaries.map((s) => s.source))],
      unknownCount: summaries.filter((s) => s.status === 'unknown').length,
      nextStep:
        symptom?.level === 'act'
          ? `You reported: ${symptom.labels.join(', ').toLowerCase()}. Tell the crew medical officer now.`
          : status === 'unknown'
            ? 'Repeat the measurement so your twin can check this system.'
            : (organ.actions[status][0] ?? 'Keep your routine going.'),
      symptoms: symptom?.labels ?? [],
      position: FIGURE_POSITION[astronaut.figure][organ.id] ?? organ.position,
    }
  })

  const counts: Record<TwinStatus, number> = { normal: 0, watch: 0, act: 0, unknown: 0 }
  for (const c of cards) counts[c.status]++

  const overall = worstTwinStatus(cards.map((c) => c.status))
  const routing = getRouting(overall === 'unknown' ? 'normal' : overall, env)
  const deep = isDeepSpace(env)
  const delay = formatDelay(env.delaySeconds)

  const headline =
    counts.act > 0
      ? `${counts.act} ${plural(counts.act, 'system needs', 'systems need')} action now.`
      : counts.watch > 0
        ? `${counts.watch} ${plural(counts.watch, 'system is', 'systems are')} drifting from your normal.`
        : counts.unknown > 0
          ? `${counts.unknown} ${plural(counts.unknown, 'system is', 'systems are')} missing data.`
          : 'Everything is within your normal.'

  const flaggedNames = cards.filter((c) => c.status === 'watch' || c.status === 'act').map((c) => c.shortName)
  const comms = commsWindow(env, MISSION_DAY, flaggedNames, input.forceBlackout ?? false)
  const blackout = comms.state === 'blackout' ? comms : null

  const subline = blackout
    ? counts.act + counts.watch > 0
      ? `Earth can't be reliably reached for ${blackout.daysUntilRestored} days (the Sun is between Earth and Mars). Your crew medical officer is your first contact.`
      : `Earth can't be reliably reached for ${blackout.daysUntilRestored} days. Your twin keeps watching and queues your reports until contact returns.`
    : counts.act + counts.watch > 0
      ? deep
        ? `Earth is ${delay} away, so your first contact is the ${routing.contact.toLowerCase()}.`
        : `You have near real-time contact with Earth. Next step: ${routing.title.toLowerCase()}.`
      : counts.unknown > 0
        ? 'Missing readings are marked Unknown, never Normal. Measure again to complete your twin.'
        : 'Keep your routine going. Your twin will flag the moment something drifts.'

  const activeHazards = [
    ...new Set(cards.filter((c) => c.status === 'watch' || c.status === 'act').flatMap((c) => c.hazards)),
  ]
  if (deep) activeHazards.push('distance')

  const dose = indicators.radiationDose?.value ?? 0

  return {
    dataLabel: DATA_LABEL,
    generatedAt: (input.now ?? new Date()).toISOString(),
    astronaut: {
      id: astronaut.id,
      name: astronaut.name,
      firstName: astronaut.name.split(' ')[0],
      role: astronaut.role,
      initials: astronaut.initials,
      figure: astronaut.figure,
    },
    overall,
    headline,
    subline,
    pitch: `Your flight surgeon is ${delay} away. Your twin is right here.`,
    readiness,
    counts,
    organs: cards,
    hotspots: Object.fromEntries(cards.map((c) => [c.id, c.status])) as Record<OrganId, TwinStatus>,
    activeHazards,
    mission: {
      missionName: MISSION_NAME,
      missionDay: MISSION_DAY,
      environmentId: env.id,
      environmentName: env.name,
      vehicleKind: env.kind,
      gravityLabel: env.gravityLabel,
      earthDelaySeconds: env.delaySeconds,
      earthDelayLabel: delay,
      roundTripLabel: formatDelay(env.delaySeconds * 2),
      deepSpace: deep,
      radiationPerDay: env.radiationPerDay,
      radiationBudgetPct: Math.round((dose / RADIATION_CAREER_LIMIT) * 100),
      environmentSource: env.source,
      effects: environmentEffects(env, exerciseRatioFrom(indicators)),
    },
    routing,
    contactChain: chainFor(overall, deep, blackout),
    comms,
    lastUpdate: {
      checkedInToday,
      lastCheckIn: checkedInToday ? 'Today' : astronaut.lastCheckIn,
      watchLastSync: WATCH_SYNC.lastSync,
      watchBattery: WATCH_SYNC.battery,
    },
    sourcesInUse: [...new Set(cards.flatMap((c) => c.sources))],
  }
}

/**
 * Server-side entry point used by GET /api/twin. Computes from the shared demo
 * data with no local check-in overrides (those live on the tablet).
 */
export function computeTwinSnapshot(
  astronaut: Astronaut,
  envId: EnvironmentId,
  now?: Date,
  options: { forceBlackout?: boolean } = {},
) {
  const env = getEnvironment(envId)
  const indicators = computeIndicators({ astronaut, env, overrides: {}, votes: astronaut.crewVotes })
  const organs = computeOrgans(indicators)
  const checkedInToday = false
  return buildTwinSnapshot({
    astronaut,
    env,
    indicators,
    organs,
    readiness: readinessScore(organs, checkedInToday),
    checkedInToday,
    now,
    forceBlackout: options.forceBlackout,
  })
}

/** Status of several astronauts at once (only the crew medical officer may request this). */
export function crewOverview(astronauts: Astronaut[], envId: EnvironmentId) {
  return astronauts.map((member) => {
    const snap = computeTwinSnapshot(member, envId)
    return {
      id: member.id,
      name: member.name,
      role: member.role,
      overall: snap.overall,
      readiness: snap.readiness,
      counts: snap.counts,
    }
  })
}
