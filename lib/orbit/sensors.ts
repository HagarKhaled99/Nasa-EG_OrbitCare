
import type { MeasuredIndicatorId } from './indicators'

export type ReadingSource = 'watch' | 'patch' | 'you'

export const READING_SOURCE: Record<MeasuredIndicatorId, ReadingSource> = {
  heartRate: 'watch',
  systolic: 'watch',
  diastolic: 'watch',
  temperature: 'watch',
  sleep: 'watch',
  exercise: 'watch',
  glucose: 'patch',
  grip: 'you',
  vision: 'you',
  mood: 'you',
}

export const SENSOR_IDS = (
  Object.keys(READING_SOURCE) as MeasuredIndicatorId[]
).filter((id) => READING_SOURCE[id] !== 'you')

export const WATCH_SYNC = {
  lastSync: 'Just now',
  battery: 100,
}

export const SENSOR_READINGS = [
  { key: 'hr', label: 'Heart rate and HRV', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'bp', label: 'Blood pressure', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'spo2', label: 'Blood oxygen', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'temp', label: 'Temperature', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'sleep', label: 'Sleep', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'exercise', label: 'Exercise minutes', note: 'Automatic simulated watch reading', device: 'Watch' },
  { key: 'glucose', label: 'Blood sugar', note: 'Simulated patch reading', device: 'Patch' },
] as const
