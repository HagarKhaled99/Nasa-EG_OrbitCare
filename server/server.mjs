// ORBIT TWIN crew API. Plain Node http + built-in SQLite: no dependencies to install.
//
//   GET    /api/health                 → { ok, astronauts }
//   GET    /api/astronauts             → list of signed-up astronauts (public fields only)
//   POST   /api/astronauts             → create (sign-up) + session cookie. 201 / 400 / 409
//   DELETE /api/astronauts/:id         → body { pin } (that astronaut's PIN or the admin PIN). 204 / 403 / 404
//   POST   /api/astronauts/:id/reset-pin → body { adminPin, newPin }: forgotten PIN. 204 / 400 / 403 / 404
//   POST   /api/auth/sign-in           → { astronautId, pin } → 200 + session cookie | 401 wrong-pin | 423 locked
//   GET    /api/auth/session           → { session } for the cookie, or 401
//   POST   /api/auth/sign-out          → clears the cookie. 204
//   GET    /api/readings?astronautId=  → daily vitals, oldest first. Signed in as that astronaut, or as the
//                                         crew medical officer. 401 / 403 otherwise
//   POST   /api/readings               → save one of YOUR readings (check-in / watch feed). 201 / 400 / 401 / 403
//
//   Member 5 (Salma) – Action Center + Crew Pulse. All need sign-in; you can only act as yourself:
//   GET/POST /api/action-steps          → ticked "do this now" steps { alertKey, stepId, completed }
//   GET/POST /api/medical-notifications → notify the onboard medical officer { alertKey, recipient }
//   GET/POST /api/medical-reports       → Medical Report Packets { report } (queued for Earth)
//   GET      /api/crew-pulse?missionDay= → { mine, aboutMe: { flags, total }, answered: [ids] }. Never who flagged whom
//   POST     /api/crew-pulse            → { missionDay, targetId, seemsLikeThemselves } (from = you)
//
//   Ground portal (Earth). Flight surgeon = medical access; mission director = readiness only:
//   GET    /api/ground/crew             → crew overview (director: no medical fields)
//   GET    /api/ground/messages?astronautId= → surgeon: advice sent + report packets received (with delay)
//   POST   /api/ground/messages         → surgeon: { astronautId, body } advice, arrives after the one-way delay
//   GET    /api/ground/fitness?astronautId= → decision history (director: without the medical note)
//   POST   /api/ground/fitness          → surgeon: { astronautId, status, restrictions, medicalNote }
//   GET    /api/inbox                   → astronaut: advice from Earth (arrived / in transit) + fitness for duty
//   POST   /api/inbox/:id/read          → astronaut: mark advice as read
//   POST   /api/demo/fast-forward       → demo: deliver everything still in transit now
//
//   POST   /api/demo/reset              → rehearsal helper: deletes YOUR check-ins, injected demo readings,
//                                         ticked steps, notifications and reports (never the SYNTHETIC_DEMO data)
//
// Sessions: signed httpOnly cookie (server/session.mjs, design by Member 2). Everyone signs in here.
//
// Run alone:  node server/server.mjs      (port 4000, or PORT=xxxx)
// Normally started together with the website by `npm run dev` (see scripts/dev.mjs).
import { createServer } from 'node:http'
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { openDatabase, toPublic, DB_PATH } from './db.mjs'
import { clearedSessionCookie, createSessions, loadSecret, readCookie, sessionCookie } from './session.mjs'
import { DEMO_DATA_VERSION, DEMO_ORIGIN, READING_COLUMNS, seedDemoReadings } from './demo-data.mjs'

export const API_PORT = Number(process.env.PORT ?? 4000)
/** Lets the crew medical officer / admin remove any profile. Change it with ORBIT_ADMIN_PIN. */
const ADMIN_PIN = process.env.ORBIT_ADMIN_PIN ?? '2026'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

// ---------- validation (mirrors src/lib/orbit/baseline.ts and profiles.ts; keep them in sync) ----------

const ROLES = ['Commander', 'Flight Engineer', 'Mission Specialist', 'Crew Medical Officer']
const MISSION_IDS = ['ares-iv', 'artemis', 'iss']
const SAMPLE_CREW_NAMES = ['sara haddad', 'ahmed nasser', 'lena fischer', 'omar rahimi']
/** Built-in sample crew (src/lib/orbit/crew.ts). They sign in with the shared demo PIN. */
const SAMPLE_CREW = [
  { id: 'sara', name: 'Sara Haddad', role: 'Mission Specialist' },
  { id: 'ahmed', name: 'Ahmed Nasser', role: 'Flight Engineer' },
  { id: 'lena', name: 'Lena Fischer', role: 'Crew Medical Officer' },
  { id: 'omar', name: 'Omar Rahimi', role: 'Commander' },
]
/**
 * Ground team (Earth). Fictional demo users. access 'medical' = flight surgeon (full medical detail, advice,
 * fitness decisions); access 'readiness' = mission director (fitness for duty only, never medical data).
 */
const GROUND_STAFF = [
  { id: 'ground-surgeon', name: 'Dr. Yasmin Farouk', role: 'Flight Surgeon', access: 'medical' },
  { id: 'ground-director', name: 'Karim Mansour', role: 'Mission Director', access: 'readiness' },
]
const GROUND_PIN = process.env.ORBIT_GROUND_PIN ?? '2026'
/** Mission → environment → one-way light delay in seconds (same values as src/lib/orbit/environments.ts). */
const MISSION_ENV = { 'ares-iv': 'mars-transit', artemis: 'moon-base', iss: 'iss' }
const ENV_DELAY_SECONDS = { 'mars-transit': 18 * 60, 'moon-base': 1.3, iss: 0.5 }
const FITNESS = ['ready', 'limited', 'not-ready']
const SAMPLE_CREW_IDS = SAMPLE_CREW.map((c) => c.id)
const DEMO_PIN = process.env.ORBIT_DEMO_PIN ?? '2026'
const CMO_ROLE = 'Crew Medical Officer'
/** Mission day of the demo data; the demo Crew Pulse votes below are for this day. */
const DEMO_MISSION_DAY = 214
/** Crew Pulse votes already cast today in the demo (same as crewVotes in src/lib/orbit/crew.ts). */
const DEMO_PULSE_VOTES = [
  ['ahmed', 'sara', false], ['lena', 'sara', false], ['omar', 'sara', true],
  ['sara', 'ahmed', true], ['lena', 'ahmed', true], ['omar', 'ahmed', true],
  ['sara', 'lena', true], ['ahmed', 'lena', false], ['omar', 'lena', true],
  ['sara', 'omar', true], ['ahmed', 'omar', true], ['lena', 'omar', true],
]

function requiredText(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, `${field}: required text (max ${max} characters)`)
  }
  return value.trim()
}
/** Plausible ranges for incoming readings (wider than baseline limits: these may be abnormal, just not impossible). */
const READING_LIMITS = {
  heart_rate_bpm: [25, 220],
  spo2_pct: [50, 100],
  blood_pressure_systolic_mmhg: [60, 250],
  blood_pressure_diastolic_mmhg: [30, 150],
  temperature_c: [32, 43],
  sleep_hours: [0, 16],
  mood_1_to_5: [1, 5],
  activity_min: [0, 600],
  radiation_dose_msv_daily: [0, 1000],
  glucose_mg_dl: [20, 600],
  grip_kg: [1, 120],
  vision_lines: [0, 10],
}
const READING_ORIGINS = ['SIMULATED_WATCH', 'MANUAL_CHECKIN']
const SENSOR_MODES = ['rest', 'motion', 'manual']
const QUALITIES = ['good', 'poor', 'no-signal']
/** Keep in sync with src/lib/orbit/symptoms.ts */
const SYMPTOM_IDS = [
  'chest-pain', 'breathless', 'fainting', 'confusion', 'vision-loss', 'headache', 'dizzy', 'nausea',
  'blurred-vision', 'congestion', 'feverish', 'back-pain', 'muscle-weakness', 'poor-sleep',
]

/** Database row → API JSON (symptoms stored as JSON text, returned as an array). */
function readingOut(row) {
  if (!row) return row
  let symptoms = null
  try {
    symptoms = row.symptoms ? JSON.parse(row.symptoms) : null
  } catch {
    symptoms = null
  }
  return { ...row, symptoms }
}
const BASELINE_LIMITS = {
  heartRate: [35, 120],
  spo2: [85, 100],
  sleep: [3, 12],
  systolic: [80, 180],
  diastolic: [45, 115],
  temperature: [35, 38.5],
  glucose: [50, 200],
  grip: [10, 90],
  vision: [1, 10],
  mood: [1, 5],
  exercise: [0, 600],
}
const REQUIRED_BASELINE = ['heartRate', 'spo2', 'sleep', 'systolic', 'diastolic', 'temperature']
const BASELINE_SOURCES = ['watch-preflight', 'manual', 'default', 'plan']

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

function ageOn(dob, today = new Date()) {
  const d = new Date(`${dob}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(d.getTime())) return null
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const m = today.getUTCMonth() - d.getUTCMonth()
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--
  return age
}

function isWeakPin(pin) {
  return /^(\d)\1+$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin)
}

function validateNewAstronaut(body) {
  const errors = []
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  if (name.length < 2 || name.length > 60) errors.push('name: 2–60 characters')
  if (SAMPLE_CREW_NAMES.includes(name.toLowerCase())) errors.push('name: already used by a sample crew member')
  if (!ROLES.includes(body?.role)) errors.push(`role: one of ${ROLES.join(', ')}`)
  const age = ageOn(body?.dob)
  if (age === null || age < 18 || age > 80) errors.push('dob: valid date, age 18–80')
  if (!MISSION_IDS.includes(body?.missionId)) errors.push(`missionId: one of ${MISSION_IDS.join(', ')}`)
  if (body?.figure !== 'female' && body?.figure !== 'male') errors.push('figure: female or male')
  if (typeof body?.pin !== 'string' || !/^\d{4}$/.test(body.pin)) errors.push('pin: exactly 4 digits')
  else if (isWeakPin(body.pin)) errors.push('pin: too easy to guess')

  const baseline = body?.baseline ?? {}
  for (const id of REQUIRED_BASELINE) if (typeof baseline[id] !== 'number') errors.push(`baseline.${id}: required`)
  for (const [id, value] of Object.entries(baseline)) {
    const limits = BASELINE_LIMITS[id]
    if (!limits) errors.push(`baseline.${id}: unknown measurement`)
    else if (typeof value !== 'number' || !Number.isFinite(value) || value < limits[0] || value > limits[1]) {
      errors.push(`baseline.${id}: must be ${limits[0]}–${limits[1]}`)
    }
  }
  if (typeof baseline.systolic === 'number' && typeof baseline.diastolic === 'number' && baseline.systolic - baseline.diastolic < 15) {
    errors.push('baseline: systolic must be at least 15 mmHg above diastolic')
  }
  const sources = body?.baselineSource ?? {}
  for (const [id, src] of Object.entries(sources)) {
    if (!BASELINE_LIMITS[id] || !BASELINE_SOURCES.includes(src)) errors.push(`baselineSource.${id}: invalid`)
  }
  const serial = (v) => v === null || v === undefined || (typeof v === 'string' && v.length <= 32)
  if (!serial(body?.devices?.watch) || !serial(body?.devices?.dosimeter)) errors.push('devices: serial string or null')

  if (errors.length) throw new HttpError(400, 'Invalid astronaut data', { errors })
  return { ...body, name }
}

// ---------- PIN hashing (scrypt, a memory-hard password hash built into Node) ----------

function hashPin(pin, salt) {
  return scryptSync(pin, salt, 32).toString('hex')
}

function pinMatches(pin, hash, salt) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return false
  const a = Buffer.from(hashPin(pin, salt), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

// ---------- API ----------

export function createApi(db = openDatabase(), { dbPath = DB_PATH } = {}) {
  const sessions = createSessions(loadSecret(dbPath))
  const demoSalt = randomBytes(16).toString('hex')
  const demoHash = hashPin(DEMO_PIN, demoSalt)
  const groundHash = hashPin(GROUND_PIN, demoSalt)

  // First start (or empty table): load the 31-day SYNTHETIC_DEMO dataset so every teammate has data.
  // First start, or the demo dataset changed: (re)load the SYNTHETIC_DEMO rows. Real check-ins are never touched.
  const demoVersion = db.prepare("SELECT value FROM meta WHERE key = 'demo_version'").get()?.value
  const demoCount = db.prepare('SELECT COUNT(*) AS n FROM readings WHERE data_origin = ?').get(DEMO_ORIGIN).n
  if (demoCount === 0 || demoVersion !== DEMO_DATA_VERSION) seedDemoReadings(db)

  const q = {
    readings: db.prepare('SELECT * FROM readings WHERE astronaut_id = ? ORDER BY mission_day ASC, timestamp_utc ASC'),
    readingById: db.prepare('SELECT * FROM readings WHERE id = ?'),
    insertReading: db.prepare(
      `INSERT INTO readings (${READING_COLUMNS.join(', ')}) VALUES (${READING_COLUMNS.map(() => '?').join(', ')})`,
    ),
    list: db.prepare('SELECT * FROM astronauts ORDER BY created_at ASC'),
    get: db.prepare('SELECT * FROM astronauts WHERE id = ?'),
    byName: db.prepare('SELECT id FROM astronauts WHERE name = ? COLLATE NOCASE'),
    insert: db.prepare(`INSERT INTO astronauts
      (id, name, role, dob, mission_id, figure, pin_hash, pin_salt, watch_serial, dosimeter_serial,
       baseline_json, baseline_source_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    remove: db.prepare('DELETE FROM astronauts WHERE id = ?'),
    setPin: db.prepare('UPDATE astronauts SET pin_hash = ?, pin_salt = ? WHERE id = ?'),
    removeReadings: db.prepare('DELETE FROM readings WHERE astronaut_id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM astronauts'),
    attempts: db.prepare('SELECT failed, locked_until FROM pin_attempts WHERE astronaut_id = ?'),
    setAttempts: db.prepare(`INSERT INTO pin_attempts (astronaut_id, failed, locked_until) VALUES (?, ?, ?)
      ON CONFLICT(astronaut_id) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until`),
    clearAttempts: db.prepare('DELETE FROM pin_attempts WHERE astronaut_id = ?'),
    audit: db.prepare('INSERT INTO audit_log (at, action, astronaut_id, detail) VALUES (?, ?, ?, ?)'),

    // Member 5 (Salma): Action Center
    listSteps: db.prepare('SELECT alert_key, step_id, completed, updated_at FROM action_step_state WHERE astronaut_id = ?'),
    saveStep: db.prepare(`INSERT INTO action_step_state (astronaut_id, alert_key, step_id, completed, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(astronaut_id, alert_key, step_id) DO UPDATE SET completed = excluded.completed, updated_at = excluded.updated_at`),
    listNotifications: db.prepare('SELECT * FROM medical_notifications WHERE astronaut_id = ? ORDER BY created_at DESC'),
    listAllNotifications: db.prepare('SELECT * FROM medical_notifications ORDER BY created_at DESC LIMIT 200'),
    addNotification: db.prepare(`INSERT INTO medical_notifications (id, astronaut_id, alert_key, recipient, status, created_at)
      VALUES (?, ?, ?, ?, 'queued', ?)`),
    listReports: db.prepare('SELECT * FROM medical_reports WHERE astronaut_id = ? ORDER BY created_at DESC'),
    listAllReports: db.prepare('SELECT * FROM medical_reports ORDER BY created_at DESC LIMIT 200'),
    addReport: db.prepare(`INSERT INTO medical_reports (id, astronaut_id, report_json, status, created_at) VALUES (?, ?, ?, 'queued', ?)`),
    removeMemberFiveData: db.prepare('DELETE FROM action_step_state WHERE astronaut_id = ?'),
    // Member 5 (Salma): Crew Pulse
    votesByMe: db.prepare('SELECT target_id, seems_like_themselves FROM crew_pulse_votes WHERE mission_day = ? AND from_id = ?'),
    votesAboutMe: db.prepare(
      'SELECT COUNT(*) AS total, SUM(seems_like_themselves = 0) AS flags FROM crew_pulse_votes WHERE mission_day = ? AND target_id = ?',
    ),
    voters: db.prepare('SELECT DISTINCT from_id FROM crew_pulse_votes WHERE mission_day = ?'),
    countVotes: db.prepare('SELECT COUNT(*) AS n FROM crew_pulse_votes'),
    saveVote: db.prepare(`INSERT INTO crew_pulse_votes (id, mission_day, from_id, target_id, seems_like_themselves, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(mission_day, from_id, target_id)
      DO UPDATE SET seems_like_themselves = excluded.seems_like_themselves, created_at = excluded.created_at`),
  }
  const audit = (action, astronautId, detail = null) => q.audit.run(new Date().toISOString(), action, astronautId, detail)

  /** Who can sign in: a sample crew member or a signed-up astronaut, with their PIN credential. */
  function account(id) {
    const sample = SAMPLE_CREW.find((c) => c.id === id)
    if (sample) return { id, name: sample.name, role: sample.role, pinHash: demoHash, pinSalt: demoSalt, sample: true, kind: 'crew' }
    const staff = GROUND_STAFF.find((g) => g.id === id)
    if (staff) return { ...staff, pinHash: groundHash, pinSalt: demoSalt, kind: 'ground' }
    const row = q.get.get(id)
    return row
      ? { id, name: row.name, role: row.role, pinHash: row.pin_hash, pinSalt: row.pin_salt, sample: false, kind: 'crew' }
      : null
  }

  /** One-way delay to this astronaut, from their mission (sample crew fly ARES-IV, Mars transit). */
  function delaySecondsFor(astronautId) {
    const row = q.get.get(astronautId)
    const missionId = row ? row.mission_id : 'ares-iv'
    return ENV_DELAY_SECONDS[MISSION_ENV[missionId] ?? 'mars-transit'] ?? 0
  }
  const crewIds = () => [...SAMPLE_CREW_IDS, ...q.list.all().map((r) => r.id)]
  const isCrew = (id) => crewIds().includes(id)

  /** The signed-in account for this request (valid cookie AND the account still exists), or null. */
  function currentSession(req) {
    const s = sessions.read(readCookie(req))
    if (!s) return null
    const acc = account(s.astronautId)
    return acc ? { ...s, role: acc.role, kind: acc.kind, access: acc.access ?? null, name: acc.name } : null
  }

  /** Astronaut-only endpoints (the ground team cannot act as a crew member). */
  function requireCrew(req) {
    const me = requireSession(req)
    if (me.kind !== 'crew') throw new HttpError(403, 'Crew members only.')
    return me
  }

  /** Ground-only endpoints. `medical: true` = flight surgeon only. */
  function requireGround(req, { medical = false } = {}) {
    const me = requireSession(req)
    if (me.kind !== 'ground') throw new HttpError(403, 'Ground team only.')
    if (medical && me.access !== 'medical') throw new HttpError(403, 'Medical data is for the flight surgeon only.')
    return me
  }

  const canSeeMedical = (me) => me.role === CMO_ROLE || me.access === 'medical'

  function requireSession(req) {
    const s = currentSession(req)
    if (!s) throw new HttpError(401, 'Sign in first.')
    return s
  }

  function startSession(astronautId) {
    const { token, session } = sessions.create(astronautId)
    return { session, cookie: sessionCookie(token) }
  }

  // First start: the demo Crew Pulse votes for today, so the page has data (same as crew.ts).
  if (q.countVotes.get().n === 0) {
    for (const [from, target, seems] of DEMO_PULSE_VOTES) {
      q.saveVote.run(randomUUID(), DEMO_MISSION_DAY, from, target, seems ? 1 : 0, new Date().toISOString())
    }
  }

  const routes = {
    'GET /api/health': () => ({ status: 200, body: { ok: true, astronauts: q.count.get().n } }),

    'GET /api/astronauts': () => ({ status: 200, body: q.list.all().map(toPublic) }),

    'POST /api/astronauts': ({ body }) => {
      const input = validateNewAstronaut(body)
      if (q.byName.get(input.name)) throw new HttpError(409, `A crew profile named “${input.name}” already exists.`)
      const id = `crew-${randomUUID().slice(0, 8)}`
      const salt = randomBytes(16).toString('hex')
      q.insert.run(
        id,
        input.name,
        input.role,
        input.dob,
        input.missionId,
        input.figure,
        hashPin(input.pin, salt),
        salt,
        input.devices?.watch ?? null,
        input.devices?.dosimeter ?? null,
        JSON.stringify(input.baseline),
        JSON.stringify(input.baselineSource ?? {}),
        new Date().toISOString(),
      )
      audit('create', id, input.name)
      const { session, cookie } = startSession(id)
      return { status: 201, body: { ...toPublic(q.get.get(id)), session }, cookie }
    },

    'POST /api/auth/sign-in': ({ body }) => {
      const row = account(String(body?.astronautId ?? ''))
      if (!row) throw new HttpError(404, 'Unknown astronaut')
      const now = Date.now()
      const state = q.attempts.get(row.id) ?? { failed: 0, locked_until: null }
      if (state.locked_until && state.locked_until > now) {
        return { status: 423, body: { ok: false, reason: 'locked', lockedUntil: state.locked_until } }
      }
      const failedSoFar = state.locked_until ? 0 : state.failed // lock expired → fresh start
      if (pinMatches(body?.pin, row.pinHash, row.pinSalt)) {
        q.clearAttempts.run(row.id)
        audit('sign-in-ok', row.id)
        const { session, cookie } = startSession(row.id)
        return { status: 200, body: { ok: true, session }, cookie }
      }
      const failed = failedSoFar + 1
      if (failed >= MAX_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_MS
        q.setAttempts.run(row.id, failed, lockedUntil)
        audit('locked', row.id)
        return { status: 423, body: { ok: false, reason: 'locked', lockedUntil } }
      }
      q.setAttempts.run(row.id, failed, null)
      audit('sign-in-fail', row.id)
      return { status: 401, body: { ok: false, reason: 'wrong-pin', attemptsLeft: MAX_ATTEMPTS - failed } }
    },

    'GET /api/auth/session': ({ req }) => {
      const s = currentSession(req)
      if (!s) return { status: 401, body: { error: 'Not signed in' }, cookie: clearedSessionCookie() }
      return {
        status: 200,
        body: {
          session: { astronautId: s.astronautId, expiresAt: s.expiresAt, kind: s.kind, role: s.role, name: s.name, access: s.access },
        },
      }
    },

    'POST /api/auth/sign-out': ({ req }) => {
      const s = currentSession(req)
      if (s) audit('sign-out', s.astronautId)
      return { status: 204, body: null, cookie: clearedSessionCookie() }
    },

    'GET /api/readings': ({ query, req }) => {
      const me = requireSession(req)
      const id = query.get('astronautId') ?? ''
      if (!id) throw new HttpError(400, 'astronautId query parameter is required')
      // Privacy: only your own readings, unless you are the crew medical officer.
      if (id !== me.astronautId && !canSeeMedical(me)) {
        throw new HttpError(403, 'You can only open your own readings.')
      }
      return { status: 200, body: q.readings.all(id).map(readingOut) }
    },

    'POST /api/readings': ({ body, req }) => {
      const me = requireCrew(req)
      const id = String(body?.astronaut_id ?? '')
      if (!SAMPLE_CREW_IDS.includes(id) && !q.get.get(id)) throw new HttpError(404, 'Unknown astronaut')
      if (id !== me.astronautId) throw new HttpError(403, 'You can only add readings to your own twin.')
      const errors = []
      if (!Number.isInteger(body?.mission_day) || body.mission_day < 0 || body.mission_day > 2000) errors.push('mission_day: integer 0–2000')
      if (!READING_ORIGINS.includes(body?.data_origin)) errors.push(`data_origin: one of ${READING_ORIGINS.join(', ')}`)
      if (body?.sensor_mode != null && !SENSOR_MODES.includes(body.sensor_mode)) errors.push('sensor_mode: rest | motion | manual')
      if (body?.quality != null && !QUALITIES.includes(body.quality)) errors.push('quality: good | poor | no-signal')
      let measured = 0
      for (const [key, [lo, hi]] of Object.entries(READING_LIMITS)) {
        const v = body?.[key]
        if (v === null || v === undefined) continue
        measured++
        if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) errors.push(`${key}: ${lo}–${hi}`)
      }
      const symptoms = body?.symptoms ?? null
      if (symptoms !== null) {
        if (!Array.isArray(symptoms) || symptoms.length > SYMPTOM_IDS.length || !symptoms.every((x) => SYMPTOM_IDS.includes(x))) {
          errors.push('symptoms: array of known symptom ids')
        } else if (symptoms.length > 0) measured++
      }
      if (measured === 0) errors.push('at least one measurement or symptom is required')
      if (errors.length) throw new HttpError(400, 'Invalid reading', { errors })
      const record = {
        ...Object.fromEntries(READING_COLUMNS.map((c) => [c, body[c] ?? null])),
        astronaut_id: id,
        timestamp_utc: typeof body.timestamp_utc === 'string' ? body.timestamp_utc : new Date().toISOString(),
        note: typeof body.note === 'string' ? body.note.slice(0, 280) : null,
        symptoms: Array.isArray(symptoms) && symptoms.length > 0 ? JSON.stringify([...new Set(symptoms)]) : null,
      }
      const info = q.insertReading.run(...READING_COLUMNS.map((c) => record[c]))
      return { status: 201, body: readingOut(q.readingById.get(info.lastInsertRowid)) }
    },

    'POST /api/astronauts/:id/reset-pin': ({ params, body }) => {
      const row = q.get.get(params.id)
      if (!row) throw new HttpError(404, 'Astronaut not found')
      // A forgotten PIN can only be replaced with the admin PIN held by the crew medical officer.
      if (typeof body?.adminPin !== 'string' || body.adminPin !== ADMIN_PIN) {
        audit('reset-pin-refused', row.id)
        throw new HttpError(403, 'Admin PIN not accepted.')
      }
      const newPin = body?.newPin
      if (typeof newPin !== 'string' || !/^\d{4}$/.test(newPin)) throw new HttpError(400, 'The new PIN must be exactly 4 digits.')
      if (isWeakPin(newPin)) throw new HttpError(400, 'Too easy to guess. Avoid repeated or sequential digits.')
      const salt = randomBytes(16).toString('hex')
      q.setPin.run(hashPin(newPin, salt), salt, row.id)
      q.clearAttempts.run(row.id) // also lifts a lockout
      audit('reset-pin', row.id, `${row.name} (by admin)`)
      return { status: 204, body: null }
    },

    // ---------- Member 5 (Salma): Action Center ----------

    'GET /api/action-steps': ({ req, query }) => {
      const me = requireSession(req)
      const alertKey = query.get('alertKey')
      const rows = q.listSteps.all(me.astronautId).filter((r) => !alertKey || r.alert_key === alertKey)
      return { status: 200, body: rows.map((r) => ({ ...r, completed: Boolean(r.completed) })) }
    },

    'POST /api/action-steps': ({ req, body }) => {
      const me = requireCrew(req)
      const alertKey = requiredText(body?.alertKey, 'alertKey', 100)
      const stepId = requiredText(body?.stepId, 'stepId', 300)
      if (typeof body?.completed !== 'boolean') throw new HttpError(400, 'completed must be true or false')
      q.saveStep.run(me.astronautId, alertKey, stepId, body.completed ? 1 : 0, new Date().toISOString())
      if (stepId === '__ack__' && body.completed) audit('alert-acknowledged', me.astronautId, alertKey)
      return { status: 200, body: { ok: true } }
    },

    // ---------- Member 5 (Salma): notify the onboard medical officer ----------

    'GET /api/medical-notifications': ({ req }) => {
      const me = requireSession(req)
      // The crew medical officer receives these, so they see everyone's; others see their own.
      const rows = canSeeMedical(me) ? q.listAllNotifications.all() : q.listNotifications.all(me.astronautId)
      return { status: 200, body: rows }
    },

    'POST /api/medical-notifications': ({ req, body }) => {
      const me = requireCrew(req)
      const alertKey = requiredText(body?.alertKey, 'alertKey', 100)
      const recipient = requiredText(body?.recipient ?? CMO_ROLE, 'recipient', 120)
      const id = randomUUID()
      const createdAt = new Date().toISOString()
      q.addNotification.run(id, me.astronautId, alertKey, recipient, createdAt)
      audit('medical-notification-queued', me.astronautId, `${alertKey} → ${recipient}`)
      return { status: 201, body: { id, astronaut_id: me.astronautId, alert_key: alertKey, recipient, status: 'queued', created_at: createdAt } }
    },

    // ---------- Member 5 (Salma): Medical Report Packets ----------

    'GET /api/medical-reports': ({ req }) => {
      const me = requireSession(req)
      const rows = canSeeMedical(me) ? q.listAllReports.all() : q.listReports.all(me.astronautId)
      return { status: 200, body: rows.map(({ report_json, ...row }) => ({ ...row, report: JSON.parse(report_json) })) }
    },

    'POST /api/medical-reports': ({ req, body }) => {
      const me = requireCrew(req)
      if (!body?.report || typeof body.report !== 'object' || Array.isArray(body.report)) {
        throw new HttpError(400, 'report must be an object')
      }
      const id = randomUUID()
      const createdAt = new Date().toISOString()
      q.addReport.run(id, me.astronautId, JSON.stringify(body.report), createdAt)
      // The packet travels to Earth with the one-way delay of this astronaut's mission.
      db.prepare('UPDATE medical_reports SET arrives_at = ? WHERE id = ?').run(
        new Date(Date.now() + delaySecondsFor(me.astronautId) * 1000).toISOString(),
        id,
      )
      audit('medical-report-queued', me.astronautId, id)
      return { status: 201, body: { id, astronaut_id: me.astronautId, report: body.report, status: 'queued', created_at: createdAt } }
    },

    // ---------- Member 5 (Salma): Crew Pulse ----------

    'GET /api/crew-pulse': ({ req, query }) => {
      const me = requireCrew(req) // Crew Pulse never leaves the station
      const missionDay = Number(query.get('missionDay'))
      if (!Number.isInteger(missionDay) || missionDay < 0) throw new HttpError(400, 'missionDay must be a non-negative integer')
      const about = q.votesAboutMe.get(missionDay, me.astronautId)
      return {
        status: 200,
        body: {
          missionDay,
          mine: q.votesByMe.all(missionDay, me.astronautId).map((v) => ({
            targetId: v.target_id,
            seemsLikeThemselves: Boolean(v.seems_like_themselves),
          })),
          // Privacy: only the combined count about you, never who flagged you.
          aboutMe: { flags: about.flags ?? 0, total: about.total ?? 0 },
          // Participation only (who answered today), never the answers.
          answered: q.voters.all(missionDay).map((v) => v.from_id),
        },
      }
    },

    'POST /api/crew-pulse': ({ req, body }) => {
      const me = requireCrew(req)
      const missionDay = body?.missionDay
      if (!Number.isInteger(missionDay) || missionDay < 0) throw new HttpError(400, 'missionDay must be a non-negative integer')
      const targetId = requiredText(body?.targetId, 'targetId', 100)
      if (!isCrew(targetId)) throw new HttpError(404, 'Unknown crewmate')
      if (targetId === me.astronautId) throw new HttpError(400, 'You cannot answer about yourself')
      if (typeof body?.seemsLikeThemselves !== 'boolean') throw new HttpError(400, 'seemsLikeThemselves must be true or false')
      q.saveVote.run(randomUUID(), missionDay, me.astronautId, targetId, body.seemsLikeThemselves ? 1 : 0, new Date().toISOString())
      audit('crew-pulse-vote', me.astronautId, `day ${missionDay}`) // not who or what: the answer stays private
      return { status: 200, body: { ok: true } }
    },

    // ---------- Ground portal ----------

    'GET /api/ground/crew': ({ req }) => {
      const me = requireGround(req)
      const people = [
        ...SAMPLE_CREW.map((c) => ({ id: c.id, name: c.name, role: c.role, missionId: 'ares-iv', signedUp: false })),
        ...q.list.all().map((r) => ({ id: r.id, name: r.name, role: r.role, missionId: r.mission_id, signedUp: true })),
      ]
      const now = Date.now()
      return {
        status: 200,
        body: people.map((p) => {
          const fitness = db
            .prepare('SELECT status, restrictions, decided_by, decided_at FROM fitness_decisions WHERE astronaut_id = ? ORDER BY decided_at DESC LIMIT 1')
            .get(p.id)
          const row = {
            ...p,
            delaySeconds: delaySecondsFor(p.id),
            lastDataAt: db.prepare('SELECT MAX(timestamp_utc) AS t FROM readings WHERE astronaut_id = ?').get(p.id).t ?? null,
            fitness: fitness
              ? { status: fitness.status, restrictions: fitness.restrictions, decidedBy: fitness.decided_by, decidedAt: fitness.decided_at }
              : null,
          }
          if (me.access !== 'medical') return row // mission director: readiness only
          const reports = db.prepare('SELECT arrives_at FROM medical_reports WHERE astronaut_id = ?').all(p.id)
          const arrived = reports.filter((r) => !r.arrives_at || Date.parse(r.arrives_at) <= now).length
          return { ...row, reportsArrived: arrived, reportsInTransit: reports.length - arrived }
        }),
      }
    },

    'GET /api/ground/messages': ({ req, query }) => {
      requireGround(req, { medical: true })
      const id = query.get('astronautId') ?? ''
      if (!isCrew(id)) throw new HttpError(404, 'Unknown astronaut')
      const now = Date.now()
      const messages = db.prepare('SELECT * FROM ground_messages WHERE astronaut_id = ? ORDER BY sent_at ASC').all(id)
      const reports = db
        .prepare('SELECT id, report_json, created_at, arrives_at FROM medical_reports WHERE astronaut_id = ? ORDER BY created_at ASC')
        .all(id)
        .map((r) => {
          const arrived = !r.arrives_at || Date.parse(r.arrives_at) <= now
          // A packet still on its way to Earth cannot be read yet.
          return { id: r.id, createdAt: r.created_at, arrivesAt: r.arrives_at ?? r.created_at, arrived, report: arrived ? JSON.parse(r.report_json) : null }
        })
      return { status: 200, body: { delaySeconds: delaySecondsFor(id), messages, reports } }
    },

    'POST /api/ground/messages': ({ req, body }) => {
      const me = requireGround(req, { medical: true })
      const id = requiredText(body?.astronautId, 'astronautId', 100)
      if (!isCrew(id)) throw new HttpError(404, 'Unknown astronaut')
      const text = requiredText(body?.body, 'body', 1000)
      const sentAt = new Date()
      const arrivesAt = new Date(sentAt.getTime() + delaySecondsFor(id) * 1000)
      const msg = { id: randomUUID(), astronaut_id: id, from_id: me.astronautId, from_name: `${me.name} · ${me.role}`, body: text, sent_at: sentAt.toISOString(), arrives_at: arrivesAt.toISOString(), read_at: null }
      db.prepare(
        'INSERT INTO ground_messages (id, astronaut_id, from_id, from_name, body, sent_at, arrives_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(msg.id, msg.astronaut_id, msg.from_id, msg.from_name, msg.body, msg.sent_at, msg.arrives_at)
      audit('ground-advice-sent', id, me.astronautId)
      return { status: 201, body: msg }
    },

    'GET /api/ground/fitness': ({ req, query }) => {
      const me = requireGround(req)
      const id = query.get('astronautId') ?? ''
      if (!isCrew(id)) throw new HttpError(404, 'Unknown astronaut')
      const rows = db.prepare('SELECT * FROM fitness_decisions WHERE astronaut_id = ? ORDER BY decided_at DESC').all(id)
      // Mission director: never the medical note.
      return { status: 200, body: rows.map((r) => (me.access === 'medical' ? r : { ...r, medical_note: undefined })) }
    },

    'POST /api/ground/fitness': ({ req, body }) => {
      const me = requireGround(req, { medical: true })
      const id = requiredText(body?.astronautId, 'astronautId', 100)
      if (!isCrew(id)) throw new HttpError(404, 'Unknown astronaut')
      if (!FITNESS.includes(body?.status)) throw new HttpError(400, `status: one of ${FITNESS.join(', ')}`)
      const restrictions = body?.restrictions ? requiredText(body.restrictions, 'restrictions', 200) : null
      const note = body?.medicalNote ? requiredText(body.medicalNote, 'medicalNote', 1000) : null
      const row = { id: randomUUID(), astronaut_id: id, status: body.status, restrictions, medical_note: note, decided_by: `${me.name} · ${me.role}`, decided_at: new Date().toISOString() }
      db.prepare(
        'INSERT INTO fitness_decisions (id, astronaut_id, status, restrictions, medical_note, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ).run(row.id, row.astronaut_id, row.status, row.restrictions, row.medical_note, row.decided_by, row.decided_at)
      audit('fitness-decision', id, `${row.status} by ${me.astronautId}`)
      return { status: 201, body: row }
    },

    // ---------- Astronaut inbox ----------

    'GET /api/inbox': ({ req }) => {
      const me = requireCrew(req)
      const now = Date.now()
      const messages = db
        .prepare('SELECT * FROM ground_messages WHERE astronaut_id = ? ORDER BY sent_at DESC')
        .all(me.astronautId)
        .map((m) => {
          const arrived = Date.parse(m.arrives_at) <= now
          // Still crossing space: the astronaut knows it is coming, but cannot read it yet.
          return { ...m, arrived, body: arrived ? m.body : null }
        })
      const fitness =
        db.prepare('SELECT * FROM fitness_decisions WHERE astronaut_id = ? ORDER BY decided_at DESC LIMIT 1').get(me.astronautId) ?? null
      return { status: 200, body: { delaySeconds: delaySecondsFor(me.astronautId), messages, fitness } }
    },

    'POST /api/inbox/:id/read': ({ req, params }) => {
      const me = requireCrew(req)
      const changed = db
        .prepare("UPDATE ground_messages SET read_at = ? WHERE id = ? AND astronaut_id = ? AND read_at IS NULL AND arrives_at <= ?")
        .run(new Date().toISOString(), params.id, me.astronautId, new Date().toISOString()).changes
      return { status: 200, body: { ok: true, changed } }
    },

    'POST /api/demo/fast-forward': ({ req }) => {
      const me = requireSession(req)
      const now = new Date().toISOString()
      // Demo only: skip the light-time delay so the pitch does not wait 18 minutes for Mars.
      const where = me.kind === 'crew' ? 'astronaut_id = ? AND ' : ''
      const args = me.kind === 'crew' ? [me.astronautId] : []
      const messages = db.prepare(`UPDATE ground_messages SET arrives_at = ? WHERE ${where}arrives_at > ?`).run(now, ...args, now).changes
      const reports = db.prepare(`UPDATE medical_reports SET arrives_at = ? WHERE ${where}arrives_at > ?`).run(now, ...args, now).changes
      return { status: 200, body: { ok: true, messages, reports } }
    },

    'POST /api/demo/reset': ({ req }) => {
      const me = requireCrew(req)
      const id = me.astronautId
      const removed = db.prepare('DELETE FROM readings WHERE astronaut_id = ? AND data_origin <> ?').run(id, DEMO_ORIGIN).changes
      db.prepare('DELETE FROM action_step_state WHERE astronaut_id = ?').run(id)
      db.prepare('DELETE FROM medical_notifications WHERE astronaut_id = ?').run(id)
      db.prepare('DELETE FROM medical_reports WHERE astronaut_id = ?').run(id)
      db.prepare('DELETE FROM ground_messages WHERE astronaut_id = ?').run(id)
      db.prepare('DELETE FROM fitness_decisions WHERE astronaut_id = ?').run(id)
      audit('demo-reset', id, `${removed} readings`)
      return { status: 200, body: { ok: true, removedReadings: removed } }
    },

    'DELETE /api/astronauts/:id': ({ params, body, req }) => {
      const row = q.get.get(params.id)
      if (!row) throw new HttpError(404, 'Astronaut not found')
      const byOwner = pinMatches(body?.pin, row.pin_hash, row.pin_salt)
      const byAdmin = typeof body?.pin === 'string' && body.pin === ADMIN_PIN
      if (!byOwner && !byAdmin) throw new HttpError(403, 'PIN not accepted. Use this astronaut’s PIN or the admin PIN.')
      q.remove.run(row.id)
      q.removeReadings.run(row.id)
      q.clearAttempts.run(row.id)
      q.removeMemberFiveData.run(row.id)
      db.prepare('DELETE FROM ground_messages WHERE astronaut_id = ?').run(row.id)
      db.prepare('DELETE FROM fitness_decisions WHERE astronaut_id = ?').run(row.id)
      audit('delete', row.id, `${row.name} (by ${byOwner ? 'owner' : 'admin'})`)
      // Removing the person who is signed in on this tablet ends their session.
      const me = sessions.read(readCookie(req))
      return { status: 204, body: null, cookie: me?.astronautId === row.id ? clearedSessionCookie() : undefined }
    },
  }

  // No CORS headers on purpose: the website reaches the API through the Vite proxy (same origin),
  // so the session cookie is never offered to other sites.
  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let key = `${req.method} ${url.pathname}`
    const params = {}
    const del = url.pathname.match(/^\/api\/astronauts\/([\w-]+)$/)
    if (del && req.method === 'DELETE') {
      key = 'DELETE /api/astronauts/:id'
      params.id = del[1]
    }
    const read = url.pathname.match(/^\/api\/inbox\/([\w-]+)\/read$/)
    if (read && req.method === 'POST') {
      key = 'POST /api/inbox/:id/read'
      params.id = read[1]
    }
    const reset = url.pathname.match(/^\/api\/astronauts\/([\w-]+)\/reset-pin$/)
    if (reset && req.method === 'POST') {
      key = 'POST /api/astronauts/:id/reset-pin'
      params.id = reset[1]
    }
    const route = routes[key]
    if (!route) return send(res, 404, { error: 'Not found' })

    try {
      const body = req.method === 'POST' || req.method === 'DELETE' ? await readJson(req) : undefined
      const result = route({ body, params, query: url.searchParams, req })
      if (result.cookie) res.setHeader('Set-Cookie', result.cookie)
      send(res, result.status, result.body)
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message, ...error.extra })
      console.error(error)
      send(res, 500, { error: 'Server error' })
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 100_000) {
        reject(new HttpError(413, 'Request too large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'Body must be JSON'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  if (body === null) {
    res.writeHead(status)
    return res.end()
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export function startApiServer(port = API_PORT) {
  const server = createServer(createApi())
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`
  ✖ Port ${port} is already in use. An older ORBIT TWIN server is probably still running.
    Stop it with Ctrl+C in its terminal, or in PowerShell run:
      Get-NetTCPConnection -LocalPort ${port} -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
    then run "npm run dev" again.
`)
      process.exit(1)
    }
    throw error
  })
  server.listen(port, () => {
    console.log(`  ORBIT TWIN crew API  → http://localhost:${port}/api   (database: ${DB_PATH})`)
  })
  return server
}

// Started directly: `node server/server.mjs`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) startApiServer()
