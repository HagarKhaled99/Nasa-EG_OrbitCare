import type { MeasuredIndicatorId } from './indicators'

/**
 * Where each reading comes from. Follows the project plan §3 ("exactly what we will claim"):
 *  - the watch gives heart rate, activity, estimated sleep and SpO₂ (SpO₂ = proposed device design);
 *  - blood pressure comes from a separate cuff, NOT the watch;
 *  - temperature comes from a separate thermometer;
 *  - radiation comes from a separate personal dosimeter (computed indicator, not listed here).
 */
export type ReadingSource = 'watch' | 'cuff' | 'thermometer' | 'meter' | 'you'

export const READING_SOURCE: Record<MeasuredIndicatorId, ReadingSource> = {
  heartRate: 'watch',
  spo2: 'watch',
  sleep: 'watch',
  exercise: 'watch',
  systolic: 'cuff',
  diastolic: 'cuff',
  temperature: 'thermometer',
  glucose: 'meter',
  grip: 'you',
  vision: 'you',
  mood: 'you',
}

/** Readings that stream in automatically from the simulated watch adapter. */
export const SENSOR_IDS = (Object.keys(READING_SOURCE) as MeasuredIndicatorId[]).filter(
  (id) => READING_SOURCE[id] === 'watch',
)

export const WATCH_SYNC = {
  lastSync: '07:58',
  battery: 64,
}

export type DeviceKind = 'Watch' | 'Cuff' | 'Thermometer' | 'Dosimeter' | 'Meter' | 'You'

/** What the sign-up screen tells the crew about each measurement and its honest limits. */
export const SENSOR_READINGS: ReadonlyArray<{
  key: 'hr' | 'spo2' | 'sleep' | 'activity' | 'bp' | 'temp' | 'radiation' | 'self'
  label: string
  note: string
  device: DeviceKind
}> = [
  { key: 'hr', label: 'Heart rate', note: 'Resting value taken overnight. Less reliable during exercise.', device: 'Watch' },
  { key: 'spo2', label: 'Blood oxygen (SpO₂)', note: 'Optical sensor, proposed design. A poor fit or movement gives false lows.', device: 'Watch' },
  { key: 'sleep', label: 'Sleep (estimated)', note: 'From wrist movement and light, as in NASA Standard Measures actigraphy.', device: 'Watch' },
  { key: 'activity', label: 'Activity and exercise minutes', note: 'Treadmill, cycle and resistance sessions.', device: 'Watch' },
  { key: 'bp', label: 'Blood pressure', note: 'Arm cuff, entered by you. A watch cannot measure it reliably.', device: 'Cuff' },
  { key: 'temp', label: 'Body temperature', note: 'Oral thermometer, entered by you.', device: 'Thermometer' },
  { key: 'radiation', label: 'Radiation dose', note: 'Personal dosimeter. A watch cannot detect radiation.', device: 'Dosimeter' },
  { key: 'self', label: 'Mood and symptoms', note: 'Your own daily answers. Never guessed from sensor data.', device: 'You' },
]
