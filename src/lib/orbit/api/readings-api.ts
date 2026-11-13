/**
 * Daily vitals in the crew database (`readings` table). For Member 4 (check-in + data feed) and the
 * chart / organ pages. Record format = project plan §5.
 *
 *   const history = await fetchReadings('sara')          // 31 SYNTHETIC_DEMO days, oldest first (needs sign-in)
 *   await saveReading({ astronaut_id: 'sara', mission_day: 214, heart_rate_bpm: 70,
 *                       data_origin: 'MANUAL_CHECKIN', sensor_mode: 'manual' })
 *
 * A `null` measurement means MISSING. Show it as UNKNOWN, never as normal.
 * Without the server, the same demo data is available as a static file: `/data/orbit_twin_demo.json`.
 */
import type { ReadingHistory } from '../health'
import type { MeasuredIndicatorId } from '../indicators'
import type { SymptomId } from '../symptoms'
import { ApiError, ApiUnavailableError } from './crew-api'

export type DataOrigin = 'SYNTHETIC_DEMO' | 'SIMULATED_WATCH' | 'MANUAL_CHECKIN'

export interface Reading {
  id: number
  astronaut_id: string
  timestamp_utc: string
  mission_day: number
  heart_rate_bpm: number | null
  spo2_pct: number | null
  blood_pressure_systolic_mmhg: number | null
  blood_pressure_diastolic_mmhg: number | null
  temperature_c: number | null
  sleep_hours: number | null
  mood_1_to_5: number | null
  activity_min: number | null
  radiation_dose_msv_daily: number | null
  data_origin: DataOrigin
  sensor_mode: 'rest' | 'motion' | 'manual' | null
  quality: 'good' | 'poor' | 'no-signal' | null
  note: string | null
  /** Symptoms reported at check-in (ids from src/lib/orbit/symptoms.ts), or null. */
  symptoms: SymptomId[] | null
  glucose_mg_dl: number | null
  grip_kg: number | null
  vision_lines: number | null
}

export type NewReading = Partial<Omit<Reading, 'id' | 'data_origin'>> & {
  astronaut_id: string
  mission_day: number
  data_origin: Exclude<DataOrigin, 'SYNTHETIC_DEMO'>
}

async function call(method: string, path: string, body?: unknown) {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiUnavailableError()
  }
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new ApiUnavailableError()
  }
  if (res.status >= 500 && !data) throw new ApiUnavailableError()
  return { status: res.status, data }
}

function fail(status: number, data: unknown): never {
  const body = (data ?? {}) as { error?: string; errors?: string[] }
  throw new ApiError(status, body.error ?? `Request failed (${status})`, body.errors ?? [])
}

export async function fetchReadings(astronautId: string): Promise<Reading[]> {
  const { status, data } = await call('GET', `/readings?astronautId=${encodeURIComponent(astronautId)}`)
  if (status !== 200 || !Array.isArray(data)) fail(status, data)
  return data as Reading[]
}

export async function saveReading(reading: NewReading): Promise<Reading> {
  const { status, data } = await call('POST', '/readings', reading)
  if (status !== 201) fail(status, data)
  return data as Reading
}

/** Offline fallback: the same SYNTHETIC_DEMO dataset shipped as a static file. */
/** Rehearsal helper: delete YOUR check-ins, injected demo readings, ticked steps, notifications and reports. */
export async function resetMyDemoData(): Promise<{ removedReadings: number }> {
  const { status, data } = await call('POST', '/demo/reset')
  if (status !== 200) fail(status, data)
  return data as { removedReadings: number }
}

export async function fetchDemoDatasetFile(): Promise<{ metadata: unknown; records: Omit<Reading, 'id'>[] }> {
  const res = await fetch('/data/orbit_twin_demo.json')
  if (!res.ok) throw new Error('Demo dataset file not found')
  return res.json()
}

// ---------- database rows → twin history ----------

/** Which reading column feeds which twin indicator. */
const COLUMN_TO_INDICATOR = {
  heart_rate_bpm: 'heartRate',
  spo2_pct: 'spo2',
  blood_pressure_systolic_mmhg: 'systolic',
  blood_pressure_diastolic_mmhg: 'diastolic',
  temperature_c: 'temperature',
  sleep_hours: 'sleep',
  mood_1_to_5: 'mood',
  activity_min: 'exercise',
  glucose_mg_dl: 'glucose',
  grip_kg: 'grip',
  vision_lines: 'vision',
} as const satisfies Partial<Record<keyof Reading, MeasuredIndicatorId>>

/**
 * Turn database rows into one value per mission day per indicator, for `computeIndicators({ readings })`.
 * Rows are ordered oldest first, so for the same day a later row (e.g. today's manual check-in) wins.
 * A day whose LATEST row has no value for a column (sensor gave no signal) stays `null` → UNKNOWN on the twin.
 */
export function toReadingHistory(rows: Reading[]): ReadingHistory {
  const byIndicator = new Map<MeasuredIndicatorId, Map<number, number | null>>()
  for (const row of rows) {
    for (const [column, indicator] of Object.entries(COLUMN_TO_INDICATOR) as Array<[keyof Reading, MeasuredIndicatorId]>) {
      const value = (row[column] ?? null) as number | null // absent field = not measured
      const days = byIndicator.get(indicator) ?? new Map<number, number | null>()
      // A later row without this measurement does not erase an earlier same-day value (a check-in may only
      // contain blood pressure); but the demo "no signal" row is the only row that day, so it stays null.
      if (value !== null || !days.has(row.mission_day)) days.set(row.mission_day, value)
      byIndicator.set(indicator, days)
    }
  }
  const history: ReadingHistory = {}
  for (const [indicator, days] of byIndicator) {
    // Never measured in the database at all (e.g. grip in the demo rows): leave it out, so the twin uses its
    // other source instead of calling it Unknown. A missing value on a day that HAS readings stays missing.
    if ([...days.values()].every((v) => v === null)) continue
    history[indicator] = [...days.entries()].sort((a, b) => a[0] - b[0]).map(([day, value]) => ({ day, value }))
  }
  return history
}
