// App logic tests (no browser needed): twin status from database readings, missing data = Unknown,
// symptoms, live watch adapter, organ explanations, Mars blackout, honest history for new astronauts.
import { CREW, type Astronaut } from '../src/lib/orbit/crew'
import { getEnvironment, type EnvironmentId } from '../src/lib/orbit/environments'
import { computeIndicators, computeOrgans, readinessScore, worstStatus } from '../src/lib/orbit/health'
import { buildTwinSnapshot } from '../src/lib/orbit/twin'
import { buildAnswers, organShownStatus, sourceLabel } from '../src/lib/orbit/organ-explain'
import { SYMPTOMS, symptomLevels, type SymptomId } from '../src/lib/orbit/symptoms'
import { latestGood, liveAverage, nextWatchSample, type WatchSample } from '../src/lib/orbit/sensor-adapter'
import { toReadingHistory, type Reading } from '../src/lib/orbit/api/readings-api'
import { profileToAstronaut } from '../src/lib/orbit/profiles'
import { runValidation } from '../src/lib/orbit/validation'
import dataset from '../public/data/orbit_twin_demo.json'

type T = (name: string, ok: boolean, detail?: unknown) => void

const rowsFor = (id: string) => (dataset as { records: Reading[] }).records.filter((r) => r.astronaut_id === id)

function twin(
  a: Astronaut,
  opts: { env?: EnvironmentId; extra?: Partial<Reading>[]; symptoms?: SymptomId[]; blackout?: boolean; invent?: boolean } = {},
) {
  const env = getEnvironment(opts.env ?? 'mars-transit')
  const rows = [...rowsFor(a.id), ...((opts.extra ?? []) as Reading[])]
  const indicators = computeIndicators({
    astronaut: a,
    env,
    overrides: {},
    votes: a.crewVotes,
    readings: toReadingHistory(rows),
    inventHistory: opts.invent ?? true,
  })
  const reported = symptomLevels(opts.symptoms ?? [])
  const organs = computeOrgans(indicators).map((o) =>
    reported[o.organ.id] ? { ...o, status: worstStatus([o.status, reported[o.organ.id]!.level]) } : o,
  )
  const snap = buildTwinSnapshot({
    astronaut: a,
    env,
    indicators,
    organs,
    readiness: readinessScore(organs, false),
    checkedInToday: false,
    forceBlackout: opts.blackout,
    symptoms: opts.symptoms,
  })
  return { indicators, organs, snap }
}

const crew = (id: string) => CREW.find((c) => c.id === id)!
const card = (s: ReturnType<typeof twin>['snap'], organ: string) => s.organs.find((o) => o.id === organ)!
const ind = (s: ReturnType<typeof twin>['snap'], organ: string, id: string) => card(s, organ).indicators.find((i) => i.id === id)!
const injected = (a: string, values: Partial<Reading>): Partial<Reading> => ({
  astronaut_id: a,
  mission_day: 214,
  timestamp_utc: '2026-11-13T10:00:00Z',
  data_origin: 'SIMULATED_WATCH',
  quality: 'good',
  ...values,
})

export function run(t: T) {
  // ---------- demo dataset ----------
  const sara = twin(crew('sara')).snap
  t('Sara: heart rate 73 → Watch (trend demo)', ind(sara, 'heart', 'heartRate').value === 73 && ind(sara, 'heart', 'heartRate').status === 'watch')
  const lena = twin(crew('lena')).snap
  t('Lena: missing SpO₂ → Unknown, never normal', ind(lena, 'heart', 'spo2').status === 'unknown' && ind(lena, 'heart', 'spo2').value === null)
  // The plan's story (§4): only Sara is flagged at the start, Lena has one missing reading, Ahmed and Omar healthy.
  const flagged = (id: string) => twin(crew(id)).snap.organs.filter((o) => o.status !== 'normal').map((o) => `${o.id}:${o.status}`)
  t('start: Sara only heart + brain Watch', flagged('sara').sort().join() === 'brain:watch,heart:watch', flagged('sara'))
  t('start: Ahmed all normal', flagged('ahmed').length === 0, flagged('ahmed'))
  t('start: Lena only heart Unknown (missing SpO₂)', flagged('lena').join() === 'heart:unknown', flagged('lena'))
  t('start: Omar all normal', flagged('omar').length === 0, flagged('omar'))
  const dbShaped = rowsFor('ahmed').map((r) => ({ glucose_mg_dl: null, grip_kg: null, vision_lines: null, ...r }))
  const fromDb = computeIndicators({ astronaut: crew('ahmed'), env: getEnvironment('iss'), overrides: {}, votes: [], readings: toReadingHistory(dbShaped as Reading[]) })
  t('columns never measured in the database do not become Unknown', [fromDb.grip, fromDb.vision, fromDb.glucose].every((i) => Number.isFinite(i.value)))
  const omar = twin(crew('omar')).snap
  t('Omar starts healthy (heart normal)', card(omar, 'heart').status === 'normal', card(omar, 'heart').status)
  const omarEmergency = twin(crew('omar'), { extra: [injected('omar', { spo2_pct: 87 })] }).snap
  t('demo injection SpO₂ 87 → Omar heart Act', card(omarEmergency, 'heart').status === 'act' && omarEmergency.overall === 'act')
  const saraWorse = twin(crew('sara'), { extra: [injected('sara', { heart_rate_bpm: 77, sleep_hours: 5.3 })] }).snap
  t('demo "worsening reading" moves Sara from Watch to Act', card(saraWorse, 'heart').status === 'act' && card(saraWorse, 'brain').status === 'act')

  // ---------- missing data never silently normal ----------
  const ahmedNoSpo2 = twin(crew('ahmed'), { extra: [injected('ahmed', { spo2_pct: null, quality: 'no-signal' })] })
  t('a check-in row without SpO₂ does not erase the watch value', ind(ahmedNoSpo2.snap, 'heart', 'spo2').status !== 'unknown')
  const fresh = profileToAstronaut({
    id: 'crew-test01',
    name: 'Nour Adel',
    role: 'Flight Engineer',
    dob: '1990-02-02',
    missionId: 'iss',
    figure: 'female',
    devices: { watch: null, dosimeter: null },
    baseline: { ...crew('sara').baseline },
    baselineSource: {},
    createdAt: '2026-11-13T00:00:00Z',
  })
  const newbie = twin(fresh, { invent: false })
  t('new astronaut: no invented history (heart rate has no points)', newbie.indicators.heartRate.history.length === 0)
  t('new astronaut: systems without readings show Unknown', newbie.organs.some((o) => organShownStatus(o) === 'unknown'))
  t('new astronaut: no crew answers → Crew Pulse Unknown, not "seems fine"', !Number.isFinite(newbie.indicators.crewPulse.value))
  t('new astronaut: bone model still works and says it assumes the plan', /Assumes your exercise plan/.test(newbie.indicators.boneDensity.message))
  t(
    'readiness drops for Unknown systems',
    readinessScore(newbie.organs, false, newbie.organs.filter((o) => organShownStatus(o) === 'unknown').length) < 90,
  )
  t('new astronaut gets a Crew Pulse teammate from the crew', CREW.some((c) => c.id === fresh.pulseTargetId))

  // ---------- symptoms (plan §7) ----------
  const ahmed = twin(crew('ahmed')).snap
  const chest = twin(crew('ahmed'), { symptoms: ['chest-pain'] }).snap
  t('Ahmed heart normal without symptoms', card(ahmed, 'heart').status === 'normal')
  t('urgent symptom (chest pain) → heart Act although numbers are normal', card(chest, 'heart').status === 'act')
  t('headache → brain Watch', card(twin(crew('ahmed'), { symptoms: ['headache'] }).snap, 'brain').status === 'watch')

  // ---------- organ explanations (Member 3) ----------
  const ahmedChest = twin(crew('ahmed'), { symptoms: ['chest-pain'] }).organs.find((o) => o.organ.id === 'heart')!
  const answers = buildAnswers(ahmedChest, SYMPTOMS.filter((s) => s.id === 'chest-pain'))
  t('organ page: Act + headline names the symptom', organShownStatus(ahmedChest) === 'act' && /chest pain/.test(answers.changed.headline))
  t('organ steps use protocol placeholders, no invented doses', answers.todo.steps.every((s) => !/\d+\s?(mg|mL|IU)\b/.test(s)), answers.todo.steps)
  t('data sources name the real devices', sourceLabel('systolic').includes('cuff') && sourceLabel('glucose').includes('meter') && sourceLabel('radiationDose').includes('dosimeter'))

  // ---------- live watch adapter ----------
  const packets = Array.from({ length: 2000 }, (_, i) => nextWatchSample({ heartRate: 64, spo2: 88 }, i))
  const good = packets.filter((p) => p.spo2Quality === 'good')
  const motion = packets.filter((p) => p.spo2Quality === 'motion')
  t('about 1 in 8 packets taken while moving', motion.length > 150 && motion.length < 350, motion.length)
  t('good SpO₂ packets stay near today’s value (87–89)', good.every((p) => p.spo2! >= 87 && p.spo2! <= 89))
  t('no-signal centre → packet without a value', nextWatchSample({ heartRate: 70, spo2: null }).spo2 === null)
  t(
    'motion packets are never used',
    latestGood([
      { at: 1, heartRate: 60, spo2: 97, heartRateQuality: 'good', spo2Quality: 'good' },
      { at: 2, heartRate: 95, spo2: 91, heartRateQuality: 'motion', spo2Quality: 'motion' },
    ]).heartRate?.value === 60,
  )

  // Bug found with Sara: her heart rate is 73 (Watch) and Act starts at 74.4, so ONE noisy packet of 75
  // raised the full-screen emergency. The twin now uses the 1-minute average of good packets.
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const stream: WatchSample[] = []
  let worstSingle = 0
  let worstAverage = 0
  for (let i = 0; i < 5000; i++) {
    const p = nextWatchSample({ heartRate: 73, spo2: 98 }, i * 5000, rand)
    stream.push(p)
    if (stream.length > 24) stream.shift()
    if (p.heartRateQuality === 'good') worstSingle = Math.max(worstSingle, p.heartRate!)
    worstAverage = Math.max(worstAverage, liveAverage(stream).heartRate?.value ?? 0)
  }
  t('single watch packets for Sara do reach 75 bpm (the bug)', worstSingle >= 75, worstSingle)
  t('Sara: the 1-minute average never reaches Act (75 bpm) in 7 hours of packets', worstAverage > 0 && worstAverage <= 74, worstAverage)
  t('no live value from fewer than 6 good packets', liveAverage(stream.slice(-3)).heartRate === null)
  const saraLive = computeIndicators({
    astronaut: crew('sara'), env: getEnvironment('mars-transit'), overrides: { heartRate: 74 }, votes: [],
    readings: toReadingHistory(rowsFor('sara')),
  }).heartRate
  t('Sara with live average 74 stays Watch, not Act', saraLive.status === 'watch', saraLive.status)

  // ---------- environments and Mars blackout (Member 2) ----------
  const mars = twin(crew('omar'), { extra: [injected('omar', { spo2_pct: 87 })] }).snap
  t('Mars day 214: blackout warning 6 days ahead', mars.comms.state === 'pre-blackout' && mars.comms.daysUntilBlackout === 6)
  const blackout = twin(crew('omar'), { extra: [injected('omar', { spo2_pct: 87 })], blackout: true }).snap
  t('blackout: contact stays on board, seriousness unchanged', blackout.overall === 'act' && blackout.contactChain[1] === 'Crew medical officer')
  const iss = twin(crew('omar'), { env: 'iss', extra: [injected('omar', { spo2_pct: 87 })], blackout: true }).snap
  t('ISS: no blackout; same Act status, different contact', iss.comms.state === 'reachable' && iss.overall === 'act' && iss.contactChain.join() !== blackout.contactChain.join())

  // ---------- heart rate / sleep wait for a second day before Watch (chosen by the validation) ----------
  const hrOn = (values: number[]) =>
    computeIndicators({
      astronaut: crew('ahmed'),
      env: getEnvironment('iss'),
      overrides: {},
      votes: [],
      readings: { heartRate: values.map((value, i) => ({ day: 214 - values.length + 1 + i, value })) },
    }).heartRate
  const oneDay = hrOn([58, 58, 58, 65]) // Ahmed's normal 58 → 65 is 12 % above, one day only
  t('heart rate 1 day off → stays normal, says it will check again tomorrow', oneDay.status === 'normal' && /tomorrow/.test(oneDay.message), oneDay.message)
  t('heart rate 2 days off → Watch', hrOn([58, 58, 65, 66]).status === 'watch')
  t('heart rate far off (Act) fires at once, never delayed', hrOn([58, 58, 58, 75]).status === 'act')

  // ---------- validation on 1,000 simulated astronauts (in memory only) ----------
  const v = runValidation()
  const old = runValidation({ rule: 'single-day' })
  t('validation: 1,000 simulated astronauts, about 40 % with a hidden problem', v.astronauts === 1000 && v.withProblem > 350 && v.withProblem < 450, v.withProblem)
  t('validation: no hidden problem is ever missed', v.missed === 0, v.byKind)
  t('validation: at least 90 % caught before they become serious', v.caughtEarly / v.withProblem >= 0.9, v.caughtEarly)
  t('validation: warning comes days ahead (median ≥ 3 days)', (v.medianLeadDays ?? 0) >= 3, v.medianLeadDays)
  t('validation: false Act alarms stay rare (< 0.25 per astronaut-month)', v.falseActPer30 < 0.25, v.falseActPer30)
  t('validation: our rule cuts false Watch alarms at least 2x without losing early catches', v.falseWatchPer30 * 2 <= old.falseWatchPer30 && v.caughtEarly >= old.caughtEarly, [v.falseWatchPer30, old.falseWatchPer30])
  t('validation: every missing reading shows Unknown, never normal', v.missingShownUnknown === 1 && v.missingDays > 0)
  t('validation: same seed → same result (repeatable)', runValidation({ astronauts: 50, seed: 9 }).caughtEarly === runValidation({ astronauts: 50, seed: 9 }).caughtEarly)
}
