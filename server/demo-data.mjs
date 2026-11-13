// SYNTHETIC_DEMO dataset generator for ORBIT TWIN.
//
// Produces 31 days of daily vitals for the four built-in sample crew, ending on the app's mission day (214).
// NOT real astronaut data. Every record is labelled data_origin = 'SYNTHETIC_DEMO' (project plan §4).
//
// Recipe (so judges can see exactly how the numbers were made):
//   value(day) = personal pre-flight baseline            (same numbers as src/lib/orbit/crew.ts)
//              + in-flight adaptation offset             (e.g. shorter sleep in space)
//              + day-to-day Gaussian variation           (typical SD per measurement, truncated at ±2 SD)
//              → kept inside the personal normal band     (80 % of the app's watch threshold)
//              + scripted demo event                     (plan §4 / §11 demo cases)
// Deterministic: a fixed seed per astronaut, so every teammate gets identical data.

export const DEMO_ORIGIN = 'SYNTHETIC_DEMO'
export const DEMO_DAYS = 31
export const LAST_MISSION_DAY = 214 // keep in sync with MISSION_DAY in src/lib/orbit/crew.ts
/** Mission day 214 = 13 Nov 2026, 07:00 UTC (morning check-in). Fixed so the data never shifts. */
const LAST_DAY_UTC = Date.UTC(2026, 10, 13, 7, 0, 0)
const DAY_MS = 86_400_000
/** Mars transit daily dose, Curiosity RAD cruise measurement (~1.8 mSv/day). Same as environments.ts. */
const RADIATION_MSV_PER_DAY = 1.84

/** Typical day-to-day standard deviation of each measurement in a healthy adult at rest. */
const VARIATION = {
  heart_rate_bpm: 2.5,
  spo2_pct: 0.7,
  blood_pressure_systolic_mmhg: 5,
  blood_pressure_diastolic_mmhg: 3,
  temperature_c: 0.12,
  sleep_hours: 0.3,
  activity_min: 6, // prescribed exercise plan: small day-to-day variation
  radiation: 0.1, // ±10 % of the daily dose (shielding, orientation, solar activity)
}

/**
 * In-flight adaptation applied to everyone. Kept deliberately small and explainable:
 *  - sleep: NASA-funded actigraphy studies report ~6 h/night on the ISS versus more on the ground,
 *    so we subtract 0.4 h from the pre-flight baseline.
 */
const IN_FLIGHT_OFFSET = { sleep_hours: -0.2 }

/**
 * The app's "watch" thresholds (src/lib/orbit/indicators.ts: watchPct, keep in sync). On normal days every value
 * is kept within 80 % of these, so ONLY the scripted demo events below raise alerts. `low` = only drops matter.
 */
const WATCH_BAND = {
  heart_rate_bpm: { key: 'hr', pct: 0.1 },
  spo2_pct: { key: 'spo2', pct: 0.03, low: true },
  blood_pressure_systolic_mmhg: { key: 'sys', pct: 0.1 },
  blood_pressure_diastolic_mmhg: { key: 'dia', pct: 0.1 },
  temperature_c: { key: 'temp', pct: 0.015 },
  sleep_hours: { key: 'sleep', pct: 0.1, low: true },
  activity_min: { key: 'activity', pct: 0.1, low: true },
}
const BAND_MARGIN = 0.8

function keepInNormalBand(r, c) {
  for (const [col, { key, pct, low }] of Object.entries(WATCH_BAND)) {
    const base = c[key]
    const lo = base * (1 - pct * BAND_MARGIN)
    const hi = low ? Infinity : base * (1 + pct * BAND_MARGIN)
    r[col] = clamp(r[col], lo, hi)
  }
}

// Personal baselines, identical to src/lib/orbit/crew.ts (pre-flight values).
const CREW = [
  { id: 'sara', name: 'Sara Haddad', seed: 31, hr: 62, spo2: 98, sys: 116, dia: 75, temp: 36.7, sleep: 7.5, mood: 4, activity: 150 },
  { id: 'ahmed', name: 'Ahmed Nasser', seed: 74, hr: 58, spo2: 97, sys: 121, dia: 78, temp: 36.6, sleep: 7.0, mood: 4, activity: 150 },
  { id: 'lena', name: 'Lena Fischer', seed: 119, hr: 65, spo2: 98, sys: 112, dia: 72, temp: 36.6, sleep: 7.5, mood: 5, activity: 150 },
  { id: 'omar', name: 'Omar Rahimi', seed: 56, hr: 60, spo2: 97, sys: 124, dia: 80, temp: 36.8, sleep: 6.5, mood: 4, activity: 150 },
]

/**
 * Scripted demo events. `daysBeforeEnd` 0 = mission day 214 (today).
 *  - Sara:  gradual change. Resting HR rises ~18 % and sleep falls ~17 % over the last 5 days (trend demo).
 *  - Ahmed: missed exercise. Activity drops ~15 % over the last 6 days (countermeasure demo).
 *  - Lena:  early infection pattern. Temperature 37.9 °C and HR +12 % on the last 2 days. SpO₂ MISSING today
 *           (sensor gave no signal), so the app must show UNKNOWN, never normal.
 *  - Omar:  one-day low SpO₂ of 88 % today with a good-quality reading (emergency demo, below the 90 % demo limit).
 */
function applyEvents(id, back, r) {
  const ramp = (days) => (back < days ? (days - back) / days : 0) // 0 → 1 as we approach today
  if (id === 'sara') {
    if (back < 5) {
      r.heart_rate_bpm = 62 * (1 + 0.18 * ramp(5)) + r._noise.hr * 0.4
      r.sleep_hours = 7.5 * (1 - 0.17 * ramp(5)) + r._noise.sleep * 0.3
    }
    if (back === 0) Object.assign(r, { heart_rate_bpm: 73, sleep_hours: 6.2 })
  }
  if (id === 'ahmed' && back < 6) r.activity_min = 150 * (1 - 0.15 * (0.6 + 0.4 * ramp(6))) + r._noise.activity * 0.3
  if (id === 'lena' && back < 2) {
    r.temperature_c = back === 0 ? 37.9 : 37.6
    r.heart_rate_bpm = 65 * 1.12 + r._noise.hr * 0.3
    if (back === 0) {
      r.mood_1_to_5 = 3
      r.spo2_pct = null
      r.quality = 'no-signal'
      r.note = 'SpO₂ missing: optical sensor reported no signal. Must display UNKNOWN.'
    }
  }
  if (id === 'omar' && back === 0) {
    r.spo2_pct = 88
    r.sensor_mode = 'rest'
    r.note = 'Demo emergency event: low SpO₂ with good signal quality.'
  }
}

// ---------- deterministic randomness ----------

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Standard normal value, truncated to ±2 SD. Without truncation a rare extreme draw (e.g. −4 SD) can create
 * an accidental "alert" the demo didn't plan; with it, only the scripted events below cross alert thresholds.
 */
function gaussian(rand) {
  const u = Math.max(rand(), 1e-12)
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
  return Math.max(-2, Math.min(2, z))
}

const round = (v, d = 0) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ---------- generator ----------

export function generateDemoReadings() {
  const rows = []
  for (const c of CREW) {
    const rand = mulberry32(c.seed * 9973)
    for (let back = DEMO_DAYS - 1; back >= 0; back--) {
      const day = LAST_MISSION_DAY - back
      const n = {
        hr: gaussian(rand),
        spo2: gaussian(rand),
        sys: gaussian(rand),
        dia: gaussian(rand),
        temp: gaussian(rand),
        sleep: gaussian(rand),
        activity: gaussian(rand),
        rad: gaussian(rand),
        mood: rand(),
      }
      const r = {
        _noise: n,
        astronaut_id: c.id,
        timestamp_utc: new Date(LAST_DAY_UTC - back * DAY_MS + Math.round(rand() * 40) * 60_000).toISOString(),
        mission_day: day,
        heart_rate_bpm: c.hr + n.hr * VARIATION.heart_rate_bpm,
        spo2_pct: c.spo2 + n.spo2 * VARIATION.spo2_pct,
        blood_pressure_systolic_mmhg: c.sys + n.sys * VARIATION.blood_pressure_systolic_mmhg,
        blood_pressure_diastolic_mmhg: c.dia + n.dia * VARIATION.blood_pressure_diastolic_mmhg,
        temperature_c: c.temp + n.temp * VARIATION.temperature_c,
        sleep_hours: c.sleep + IN_FLIGHT_OFFSET.sleep_hours + n.sleep * VARIATION.sleep_hours,
        mood_1_to_5: c.mood, // self-report: stays at the person's usual answer unless a demo event changes it
        activity_min: c.activity + n.activity * VARIATION.activity_min,
        radiation_dose_msv_daily: RADIATION_MSV_PER_DAY * (1 + n.rad * VARIATION.radiation),
        data_origin: DEMO_ORIGIN,
        sensor_mode: 'rest',
        quality: 'good',
        note: null,
      }
      keepInNormalBand(r, c)
      applyEvents(c.id, back, r)
      delete r._noise
      rows.push({
        ...r,
        heart_rate_bpm: round(r.heart_rate_bpm),
        spo2_pct: r.spo2_pct === null ? null : round(clamp(r.spo2_pct, 80, 100)),
        blood_pressure_systolic_mmhg: round(r.blood_pressure_systolic_mmhg),
        blood_pressure_diastolic_mmhg: round(r.blood_pressure_diastolic_mmhg),
        temperature_c: round(r.temperature_c, 1),
        sleep_hours: round(clamp(r.sleep_hours, 3, 11), 1),
        mood_1_to_5: clamp(r.mood_1_to_5, 1, 5),
        activity_min: round(Math.max(0, r.activity_min)),
        radiation_dose_msv_daily: round(r.radiation_dose_msv_daily, 2),
      })
    }
  }
  return rows
}

export const READING_COLUMNS = [
  'astronaut_id',
  'timestamp_utc',
  'mission_day',
  'heart_rate_bpm',
  'spo2_pct',
  'blood_pressure_systolic_mmhg',
  'blood_pressure_diastolic_mmhg',
  'temperature_c',
  'sleep_hours',
  'mood_1_to_5',
  'activity_min',
  'radiation_dose_msv_daily',
  'data_origin',
  'sensor_mode',
  'quality',
  'note',
  'symptoms',
]

/** Replace all SYNTHETIC_DEMO rows in the database with a freshly generated set (idempotent). */
export function seedDemoReadings(db) {
  const rows = generateDemoReadings()
  const insert = db.prepare(
    `INSERT INTO readings (${READING_COLUMNS.join(', ')}) VALUES (${READING_COLUMNS.map(() => '?').join(', ')})`,
  )
  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM readings WHERE data_origin = ?').run(DEMO_ORIGIN)
    for (const r of rows) insert.run(...READING_COLUMNS.map((c) => r[c] ?? null))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return rows.length
}

export const DATASET_METADATA = {
  name: 'ORBIT TWIN demo vitals',
  data_origin: DEMO_ORIGIN,
  warning:
    'SYNTHETIC demonstration data. Not NASA or astronaut measurements. Generated by server/demo-data.mjs. Never relabel as real data.',
  astronauts: CREW.map(({ id, name }) => ({ id, name })),
  mission: 'ARES-IV · Mars transit',
  mission_days: [LAST_MISSION_DAY - DEMO_DAYS + 1, LAST_MISSION_DAY],
  recipe: {
    baseline: 'Personal pre-flight values (src/lib/orbit/crew.ts)',
    daily_variation_sd: VARIATION,
    in_flight_offset: IN_FLIGHT_OFFSET,
    normal_band: 'On non-event days every value stays within 80 % of the app watch threshold, so only the demo events raise alerts.',
    radiation: `${RADIATION_MSV_PER_DAY} mSv/day ±10 %, Mars-transit estimate from Curiosity RAD cruise measurements`,
  },
  demo_cases: {
    sara: 'Gradual change: resting HR up ~18 %, sleep down ~17 % over the last 5 days',
    ahmed: 'Exercise drop: activity down ~15 % over the last 6 days',
    lena: 'Fever pattern (37.9 °C, HR +12 %) and SpO₂ MISSING on day 214 → must show UNKNOWN',
    omar: 'One-day low SpO₂ (88 %) on day 214 → emergency demo',
  },
  units: {
    heart_rate_bpm: 'beats/min (watch, at rest)',
    spo2_pct: '% (watch optical sensor, proposed design)',
    blood_pressure_systolic_mmhg: 'mmHg (arm cuff, manual)',
    blood_pressure_diastolic_mmhg: 'mmHg (arm cuff, manual)',
    temperature_c: '°C (oral thermometer, manual)',
    sleep_hours: 'h (watch actigraphy estimate)',
    mood_1_to_5: 'self-report, 1 = very low, 5 = very good',
    activity_min: 'exercise minutes (watch)',
    radiation_dose_msv_daily: 'mSv/day (personal dosimeter, not the watch)',
  },
}
