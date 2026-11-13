/**
 * Personal pre-flight baseline captured at sign-up.
 *
 * The twin compares every in-flight reading with THIS baseline, not with textbook ranges.
 * Two kinds of limits are used here, and neither is a diagnosis:
 *  - `plausible`: input sanity limits. Outside them the value is almost certainly a typo or sensor error,
 *    so the form refuses it.
 *  - `typical`: commonly cited healthy-adult resting ranges. Outside them we only show a soft note asking
 *    the crew member to confirm with the crew medical officer (CMO). Fit astronauts often sit outside
 *    population ranges (e.g. resting heart rate in the 40s–50s), so this never blocks sign-up.
 */
import { EXERCISE_PLAN_MINUTES } from './crew'
import type { MeasuredIndicatorId } from './indicators'
import type { DeviceKind } from './sensors'

export type BaselineSource = 'watch-preflight' | 'manual' | 'default' | 'plan'

export interface BaselineField {
  id: MeasuredIndicatorId
  label: string
  unit: string
  step: number
  decimals: number
  device: DeviceKind
  required: boolean
  plausible: [number, number]
  typical?: [number, number]
  typicalSource?: string
  help: string
}

export const BASELINE_FIELDS: BaselineField[] = [
  {
    id: 'heartRate',
    label: 'Resting heart rate',
    unit: 'bpm',
    step: 1,
    decimals: 0,
    device: 'Watch',
    required: true,
    plausible: [35, 120],
    typical: [40, 100],
    typicalSource: 'AHA adult resting range 60–100 bpm. Trained athletes are often 40–60.',
    help: 'The watch’s overnight resting value, averaged over your pre-flight days.',
  },
  {
    id: 'spo2',
    label: 'Blood oxygen (SpO₂)',
    unit: '%',
    step: 1,
    decimals: 0,
    device: 'Watch',
    required: true,
    plausible: [85, 100],
    typical: [95, 100],
    typicalSource: 'Common pulse-oximetry reference: 95–100% at sea level.',
    help: 'Measured at rest with the wrist still. Values under 95% should be repeated.',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    unit: 'h',
    step: 0.1,
    decimals: 1,
    device: 'Watch',
    required: true,
    plausible: [3, 12],
    typical: [7, 9],
    typicalSource: 'AASM / Sleep Research Society: adults need 7 h or more.',
    help: 'Estimated from wrist movement and light, averaged per night.',
  },
  {
    id: 'systolic',
    label: 'Blood pressure, systolic (top number)',
    unit: 'mmHg',
    step: 1,
    decimals: 0,
    device: 'Cuff',
    required: true,
    plausible: [80, 180],
    typical: [90, 129],
    typicalSource: 'AHA/ACC 2017: normal < 120, elevated 120–129, hypertension ≥ 130.',
    help: 'Seated, arm at heart level, after 5 min rest. Average of 2–3 cuff readings.',
  },
  {
    id: 'diastolic',
    label: 'Blood pressure, diastolic (bottom number)',
    unit: 'mmHg',
    step: 1,
    decimals: 0,
    device: 'Cuff',
    required: true,
    plausible: [45, 115],
    typical: [60, 79],
    typicalSource: 'AHA/ACC 2017: normal < 80 mmHg.',
    help: 'From the same cuff measurement as the top number.',
  },
  {
    id: 'temperature',
    label: 'Body temperature',
    unit: '°C',
    step: 0.1,
    decimals: 1,
    device: 'Thermometer',
    required: true,
    plausible: [35, 38.5],
    typical: [36.1, 37.2],
    typicalSource: 'Typical adult oral temperature range at rest.',
    help: 'Oral thermometer, in the morning, before eating or drinking.',
  },
  {
    id: 'glucose',
    label: 'Fasting blood sugar',
    unit: 'mg/dL',
    step: 1,
    decimals: 0,
    device: 'Meter',
    required: false,
    plausible: [50, 200],
    typical: [70, 99],
    typicalSource: 'ADA: normal fasting glucose < 100 mg/dL.',
    help: 'Optional. Fingerstick before breakfast. Leave empty and your CMO can add it later.',
  },
  {
    id: 'grip',
    label: 'Grip strength',
    unit: 'kg',
    step: 1,
    decimals: 0,
    device: 'You',
    required: false,
    plausible: [10, 90],
    help: 'Optional. Best of three squeezes with your dominant hand, elbow bent at 90°.',
  },
  {
    id: 'vision',
    label: 'Near-vision card',
    unit: 'lines',
    step: 1,
    decimals: 0,
    device: 'You',
    required: false,
    plausible: [1, 10],
    help: 'Optional. Lines read clearly at 40 cm with the weaker eye.',
  },
]

/**
 * Values used when an optional field is left empty. They are marked `default` in the profile and shown
 * as "not personal yet" so nobody mistakes them for a measured baseline.
 */
export function defaultBaseline(figure: 'female' | 'male'): Partial<Record<MeasuredIndicatorId, number>> {
  return {
    glucose: 90,
    grip: figure === 'female' ? 30 : 45,
    vision: 10,
    mood: 4,
    exercise: EXERCISE_PLAN_MINUTES,
  }
}

export type FieldCheck =
  | { state: 'empty' }
  | { state: 'invalid'; message: string }
  | { state: 'ok'; value: number; note?: string }

export function checkBaselineValue(field: BaselineField, raw: string): FieldCheck {
  const text = raw.trim()
  if (text === '') return { state: 'empty' }
  const value = Number(text.replace(',', '.'))
  if (!Number.isFinite(value)) return { state: 'invalid', message: 'Enter a number.' }
  const [min, max] = field.plausible
  if (value < min || value > max) {
    return {
      state: 'invalid',
      message: `Must be between ${min} and ${max} ${field.unit}. Check the device and measure again.`,
    }
  }
  if (field.typical && (value < field.typical[0] || value > field.typical[1])) {
    return {
      state: 'ok',
      value,
      note: `Outside the typical range (${field.typical[0]}–${field.typical[1]} ${field.unit}). That can be normal for you. Confirm it with your CMO before launch.`,
    }
  }
  return { state: 'ok', value }
}

/** Cross-field rule: systolic must be clearly above diastolic, otherwise the cuff reading is wrong. */
export function checkPulsePressure(systolic?: number, diastolic?: number): string | null {
  if (systolic === undefined || diastolic === undefined) return null
  if (systolic - diastolic < 15) {
    return 'The top number should be at least 15 mmHg above the bottom one. Measure again with the cuff.'
  }
  return null
}

// ---------- simulated watch import ----------

export interface PreflightStat {
  mean: number
  sd: number
  n: number
}

export const PREFLIGHT_DAYS = 30

function seeded(seedText: string) {
  let h = 2166136261
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

function stats(values: number[], decimals: number): PreflightStat {
  const n = values.length
  const mean = values.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1))
  const f = 10 ** decimals
  return { mean: Math.round(mean * f) / f, sd: Math.round(sd * 10) / 10, n }
}

/**
 * SYNTHETIC_DEMO: simulates the watch's 30 pre-flight nights (L-30 to L-1) and returns mean ± SD.
 * Deterministic per crew member so the demo is repeatable. Not real data.
 */
export function simulatePreflightWatch(seedText: string): Record<'heartRate' | 'spo2' | 'sleep', PreflightStat> {
  const rand = seeded(seedText.trim().toLowerCase() || 'crew')
  const normal = () => {
    const u = Math.max(rand(), 1e-9)
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  }
  const hrCenter = 54 + rand() * 14
  const spo2Center = 97 + rand() * 1.5
  const sleepCenter = 6.8 + rand() * 1
  const hr: number[] = []
  const spo2: number[] = []
  const sleep: number[] = []
  for (let day = 0; day < PREFLIGHT_DAYS; day++) {
    hr.push(hrCenter + normal() * 2.5)
    spo2.push(Math.min(100, spo2Center + normal() * 0.7))
    sleep.push(sleepCenter + normal() * 0.45)
  }
  return { heartRate: stats(hr, 0), spo2: stats(spo2, 0), sleep: stats(sleep, 1) }
}
