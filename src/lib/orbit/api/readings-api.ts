/**
 * Daily vitals in the crew database (`readings` table). For Member 4 (check-in + data feed) and the
 * chart / organ pages. Record format = project plan §5.
 *
 *   const history = await fetchReadings('sara')          // 31 SYNTHETIC_DEMO days, oldest first
 *   await saveReading({ astronaut_id: 'sara', mission_day: 214, heart_rate_bpm: 70,
 *                       data_origin: 'MANUAL_CHECKIN', sensor_mode: 'manual' })
 *
 * A `null` measurement means MISSING. Show it as UNKNOWN, never as normal.
 * Without the server, the same demo data is available as a static file: `/data/orbit_twin_demo.json`.
 */
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
export async function fetchDemoDatasetFile(): Promise<{ metadata: unknown; records: Omit<Reading, 'id'>[] }> {
  const res = await fetch('/data/orbit_twin_demo.json')
  if (!res.ok) throw new Error('Demo dataset file not found')
  return res.json()
}
