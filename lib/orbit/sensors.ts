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

export const SENSOR_IDS = (Object.keys(READING_SOURCE) as MeasuredIndicatorId[]).filter(
  (id) => READING_SOURCE[id] !== 'you',
)

export const WATCH_SYNC = {
  lastSync: '07:58',
  battery: 64,
}

export const SENSOR_READINGS = [
  { key: 'hr', label: 'Resting heart rate and HRV', note: 'Overnight, while you sleep', device: 'Watch' },
  { key: 'bp', label: 'Blood pressure', note: 'Cuffless estimate, checked weekly with a cuff', device: 'Watch' },
  { key: 'spo2', label: 'Blood oxygen', note: 'Several times per night', device: 'Watch' },
  { key: 'temp', label: 'Skin temperature', note: 'Continuous, spots early fever', device: 'Watch' },
  { key: 'sleep', label: 'Sleep', note: 'Duration and sleep stages', device: 'Watch' },
  { key: 'exercise', label: 'Exercise minutes', note: 'Treadmill, cycle and resistance device', device: 'Watch' },
  { key: 'glucose', label: 'Blood sugar', note: 'Every 15 minutes', device: 'Patch' },
] as const
