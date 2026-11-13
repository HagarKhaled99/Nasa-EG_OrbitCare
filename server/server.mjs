
// ORBIT TWIN crew API. Plain Node http + built-in SQLite: no dependencies to install.
import { createServer } from 'node:http'
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { openDatabase, toPublic, DB_PATH } from './db.mjs'
import { DEMO_ORIGIN, READING_COLUMNS, seedDemoReadings } from './demo-data.mjs'

export const API_PORT = Number(process.env.PORT ?? 4000)
const ADMIN_PIN = process.env.ORBIT_ADMIN_PIN ?? '2026'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

const ROLES = ['Commander', 'Flight Engineer', 'Mission Specialist', 'Crew Medical Officer']
const MISSION_IDS = ['ares-iv', 'artemis', 'iss']
const SAMPLE_CREW_NAMES = ['sara haddad', 'ahmed nasser', 'lena fischer', 'omar rahimi']
const SAMPLE_CREW_IDS = ['sara', 'ahmed', 'lena', 'omar']

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
}
const READING_ORIGINS = ['SIMULATED_WATCH', 'MANUAL_CHECKIN']
const SENSOR_MODES = ['rest', 'motion', 'manual']
const QUALITIES = ['good', 'poor', 'no-signal']
const BASELINE_LIMITS = {
  heartRate: [35, 120], spo2: [85, 100], sleep: [3, 12],
  systolic: [80, 180], diastolic: [45, 115], temperature: [35, 38.5],
  glucose: [50, 200], grip: [10, 90], vision: [1, 10],
  mood: [1, 5], exercise: [0, 600],
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

function hashPin(pin, salt) {
  return scryptSync(pin, salt, 32).toString('hex')
}

function pinMatches(pin, hash, salt) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) return false
  const a = Buffer.from(hashPin(pin, salt), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createApi(db = openDatabase()) {
  const demoCount = db.prepare('SELECT COUNT(*) AS n FROM readings WHERE data_origin = ?').get(DEMO_ORIGIN).n
  if (demoCount === 0) seedDemoReadings(db)

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
    removeReadings: db.prepare('DELETE FROM readings WHERE astronaut_id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM astronauts'),
    attempts: db.prepare('SELECT failed, locked_until FROM sign_in_attempts WHERE astronaut_id = ?'),
    setAttempts: db.prepare(`INSERT INTO sign_in_attempts (astronaut_id, failed, locked_until) VALUES (?, ?, ?)
      ON CONFLICT(astronaut_id) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until`),
    clearAttempts: db.prepare('DELETE FROM sign_in_attempts WHERE astronaut_id = ?'),
    audit: db.prepare('INSERT INTO audit_log (at, action, astronaut_id, detail) VALUES (?, ?, ?, ?)'),

    // Member 5: Action Center
    listSteps: db.prepare('SELECT alert_key, step_id, completed, updated_at FROM action_step_state WHERE astronaut_id = ? AND alert_key = ?'),
    saveStep: db.prepare(`INSERT INTO action_step_state (astronaut_id, alert_key, step_id, completed, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(astronaut_id, alert_key, step_id)
      DO UPDATE SET completed = excluded.completed, updated_at = excluded.updated_at`),

    // Member 5: Medical notifications and reports
    listNotifications: db.prepare('SELECT * FROM medical_notifications WHERE astronaut_id = ? ORDER BY created_at DESC'),
    addNotification: db.prepare(`INSERT INTO medical_notifications (id, astronaut_id, alert_key, recipient, status, created_at)
      VALUES (?, ?, ?, ?, 'queued', ?)`),
    listReports: db.prepare('SELECT * FROM medical_reports WHERE astronaut_id = ? ORDER BY created_at DESC'),
    addReport: db.prepare(`INSERT INTO medical_reports (id, astronaut_id, report_json, status, created_at)
      VALUES (?, ?, ?, 'queued', ?)`),

    // Member 5: Crew Pulse
    listVotes: db.prepare('SELECT * FROM crew_pulse_votes WHERE mission_day = ?'),
    saveVote: db.prepare(`INSERT INTO crew_pulse_votes (id, mission_day, from_id, target_id, seems_like_themselves, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(mission_day, from_id, target_id)
      DO UPDATE SET seems_like_themselves = excluded.seems_like_themselves, created_at = excluded.created_at`),
  }

  const audit = (action, astronautId, detail = null) => q.audit.run(new Date().toISOString(), action, astronautId, detail)
  const validAstronaut = (id) => SAMPLE_CREW_IDS.includes(id) || Boolean(q.get.get(id))
  const requiredText = (value, field, max = 200) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
      throw new HttpError(400, `${field}: required text (max ${max} characters)`)
    }
    return value.trim()
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
        id, input.name, input.role, input.dob, input.missionId, input.figure,
        hashPin(input.pin, salt), salt, input.devices?.watch ?? null,
        input.devices?.dosimeter ?? null, JSON.stringify(input.baseline),
        JSON.stringify(input.baselineSource ?? {}), new Date().toISOString(),
      )
      audit('create', id, input.name)
      return { status: 201, body: toPublic(q.get.get(id)) }
    },

    'POST /api/auth/sign-in': ({ body }) => {
      const row = q.get.get(String(body?.astronautId ?? ''))
      if (!row) throw new HttpError(404, 'Unknown astronaut')
      const now = Date.now()
      const state = q.attempts.get(row.id) ?? { failed: 0, locked_until: null }
      if (state.locked_until && state.locked_until > now) {
        return { status: 423, body: { ok: false, reason: 'locked', lockedUntil: state.locked_until } }
      }
      const failedSoFar = state.locked_until ? 0 : state.failed
      if (pinMatches(body?.pin, row.pin_hash, row.pin_salt)) {
        q.clearAttempts.run(row.id)
        audit('sign-in-ok', row.id)
        return { status: 200, body: { ok: true } }
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

    'GET /api/readings': ({ query }) => {
      const id = query.get('astronautId') ?? ''
      if (!id) throw new HttpError(400, 'astronautId query parameter is required')
      return { status: 200, body: q.readings.all(id) }
    },

    'POST /api/readings': ({ body }) => {
      const id = String(body?.astronaut_id ?? '')
      if (!validAstronaut(id)) throw new HttpError(404, 'Unknown astronaut')
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
      if (measured === 0) errors.push('at least one measurement is required')
      if (errors.length) throw new HttpError(400, 'Invalid reading', { errors })
      const record = {
        ...Object.fromEntries(READING_COLUMNS.map((c) => [c, body[c] ?? null])),
        astronaut_id: id,
        timestamp_utc: typeof body.timestamp_utc === 'string' ? body.timestamp_utc : new Date().toISOString(),
        note: typeof body.note === 'string' ? body.note.slice(0, 280) : null,
      }
      const info = q.insertReading.run(...READING_COLUMNS.map((c) => record[c]))
      return { status: 201, body: q.readingById.get(info.lastInsertRowid) }
    },

    // ---------- Member 5: Action Center ----------

    'GET /api/action-steps': ({ query }) => {
      const id = query.get('astronautId') ?? ''
      const alertKey = query.get('alertKey') ?? ''
      if (!id || !alertKey) throw new HttpError(400, 'astronautId and alertKey are required')
      return { status: 200, body: q.listSteps.all(id, alertKey) }
    },

    'POST /api/action-steps': ({ body }) => {
      const id = requiredText(body?.astronautId, 'astronautId', 100)
      const alertKey = requiredText(body?.alertKey, 'alertKey', 100)
      const stepId = requiredText(body?.stepId, 'stepId', 100)
      if (typeof body?.completed !== 'boolean') throw new HttpError(400, 'completed must be true or false')
      q.saveStep.run(id, alertKey, stepId, body.completed ? 1 : 0, new Date().toISOString())
      return { status: 200, body: { ok: true } }
    },

    // ---------- Member 5: Medical notifications ----------

    'GET /api/medical-notifications': ({ query }) => {
      const id = query.get('astronautId') ?? ''
      if (!id) throw new HttpError(400, 'astronautId is required')
      return { status: 200, body: q.listNotifications.all(id) }
    },

    'POST /api/medical-notifications': ({ body }) => {
      const id = requiredText(body?.astronautId, 'astronautId', 100)
      const alertKey = requiredText(body?.alertKey, 'alertKey', 100)
      const recipient = requiredText(body?.recipient, 'recipient', 120)
      const notificationId = randomUUID()
      const createdAt = new Date().toISOString()
      q.addNotification.run(notificationId, id, alertKey, recipient, createdAt)
      audit('medical-notification-queued', id, `${alertKey} → ${recipient}`)
      return { status: 201, body: { id: notificationId, astronaut_id: id, alert_key: alertKey, recipient, status: 'queued', created_at: createdAt } }
    },

    // ---------- Member 5: Medical reports ----------

    'GET /api/medical-reports': ({ query }) => {
      const id = query.get('astronautId') ?? ''
      if (!id) throw new HttpError(400, 'astronautId is required')
      return {
        status: 200,
        body: q.listReports.all(id).map((row) => ({ ...row, report: JSON.parse(row.report_json) })),
      }
    },

    'POST /api/medical-reports': ({ body }) => {
      const id = requiredText(body?.astronautId, 'astronautId', 100)
      if (!body?.report || typeof body.report !== 'object' || Array.isArray(body.report)) {
        throw new HttpError(400, 'report must be an object')
      }
      const reportId = randomUUID()
      const createdAt = new Date().toISOString()
      q.addReport.run(reportId, id, JSON.stringify(body.report), createdAt)
      audit('medical-report-queued', id, reportId)
      return { status: 201, body: { id: reportId, astronaut_id: id, report: body.report, status: 'queued', created_at: createdAt } }
    },

    // ---------- Member 5: Crew Pulse ----------

    'GET /api/crew-pulse': ({ query }) => {
      const missionDay = Number(query.get('missionDay'))
      if (!Number.isInteger(missionDay) || missionDay < 0) throw new HttpError(400, 'missionDay must be a non-negative integer')
      return { status: 200, body: q.listVotes.all(missionDay) }
    },

    'POST /api/crew-pulse': ({ body }) => {
      const missionDay = body?.missionDay
      if (!Number.isInteger(missionDay) || missionDay < 0) throw new HttpError(400, 'missionDay must be a non-negative integer')
      const fromId = requiredText(body?.fromId, 'fromId', 100)
      const targetId = requiredText(body?.targetId, 'targetId', 100)
      if (fromId === targetId) throw new HttpError(400, 'You cannot vote for yourself')
      if (typeof body?.seemsLikeThemselves !== 'boolean') throw new HttpError(400, 'seemsLikeThemselves must be true or false')
      const id = randomUUID()
      const createdAt = new Date().toISOString()
      q.saveVote.run(id, missionDay, fromId, targetId, body.seemsLikeThemselves ? 1 : 0, createdAt)
      audit('crew-pulse-vote', fromId, `day ${missionDay}: ${targetId}`)
      return { status: 200, body: { ok: true } }
    },

    'DELETE /api/astronauts/:id': ({ params, body }) => {
      const row = q.get.get(params.id)
      if (!row) throw new HttpError(404, 'Astronaut not found')
      const byOwner = pinMatches(body?.pin, row.pin_hash, row.pin_salt)
      const byAdmin = typeof body?.pin === 'string' && body.pin === ADMIN_PIN
      if (!byOwner && !byAdmin) throw new HttpError(403, 'PIN not accepted. Use this astronaut’s PIN or the admin PIN.')
      q.remove.run(row.id)
      q.removeReadings.run(row.id)
      audit('delete', row.id, `${row.name} (by ${byOwner ? 'owner' : 'admin'})`)
      return { status: 204, body: null }
    },
  }

  return async function handle(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return send(res, 204, null)

    const url = new URL(req.url ?? '/', 'http://localhost')
    let key = `${req.method} ${url.pathname}`
    const params = {}
    const del = url.pathname.match(/^\/api\/astronauts\/([\w-]+)$/)
    if (del && req.method === 'DELETE') {
      key = 'DELETE /api/astronauts/:id'
      params.id = del[1]
    }
    const route = routes[key]
    if (!route) return send(res, 404, { error: 'Not found' })

    try {
      const body = req.method === 'POST' || req.method === 'DELETE' ? await readJson(req) : undefined
      const result = route({ body, params, query: url.searchParams })
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
  server.listen(port, () => {
    console.log(`  ORBIT TWIN crew API  → http://localhost:${port}/api   (database: ${DB_PATH})`)
  })
  return server
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) startApiServer()
