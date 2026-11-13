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
// Sessions: signed httpOnly cookie (server/session.mjs, design by Member 2). Everyone signs in here.
//
// Run alone:  node server/server.mjs      (port 4000, or PORT=xxxx)
// Normally started together with the website by `npm run dev` (see scripts/dev.mjs).
import { createServer } from 'node:http'
import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { openDatabase, toPublic, DB_PATH } from './db.mjs'
import { clearedSessionCookie, createSessions, loadSecret, readCookie, sessionCookie } from './session.mjs'
import { DEMO_ORIGIN, READING_COLUMNS, seedDemoReadings } from './demo-data.mjs'

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
  { id: 'sara', role: 'Mission Specialist' },
  { id: 'ahmed', role: 'Flight Engineer' },
  { id: 'lena', role: 'Crew Medical Officer' },
  { id: 'omar', role: 'Commander' },
]
const SAMPLE_CREW_IDS = SAMPLE_CREW.map((c) => c.id)
const DEMO_PIN = process.env.ORBIT_DEMO_PIN ?? '2026'
const CMO_ROLE = 'Crew Medical Officer'
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

  // First start (or empty table): load the 31-day SYNTHETIC_DEMO dataset so every teammate has data.
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
    setPin: db.prepare('UPDATE astronauts SET pin_hash = ?, pin_salt = ? WHERE id = ?'),
    removeReadings: db.prepare('DELETE FROM readings WHERE astronaut_id = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM astronauts'),
    attempts: db.prepare('SELECT failed, locked_until FROM pin_attempts WHERE astronaut_id = ?'),
    setAttempts: db.prepare(`INSERT INTO pin_attempts (astronaut_id, failed, locked_until) VALUES (?, ?, ?)
      ON CONFLICT(astronaut_id) DO UPDATE SET failed = excluded.failed, locked_until = excluded.locked_until`),
    clearAttempts: db.prepare('DELETE FROM pin_attempts WHERE astronaut_id = ?'),
    audit: db.prepare('INSERT INTO audit_log (at, action, astronaut_id, detail) VALUES (?, ?, ?, ?)'),
  }
  const audit = (action, astronautId, detail = null) => q.audit.run(new Date().toISOString(), action, astronautId, detail)

  /** Who can sign in: a sample crew member or a signed-up astronaut, with their PIN credential. */
  function account(id) {
    const sample = SAMPLE_CREW.find((c) => c.id === id)
    if (sample) return { id, role: sample.role, pinHash: demoHash, pinSalt: demoSalt, sample: true }
    const row = q.get.get(id)
    return row ? { id, role: row.role, pinHash: row.pin_hash, pinSalt: row.pin_salt, sample: false } : null
  }

  /** The signed-in account for this request (valid cookie AND the account still exists), or null. */
  function currentSession(req) {
    const s = sessions.read(readCookie(req))
    if (!s) return null
    const acc = account(s.astronautId)
    return acc ? { ...s, role: acc.role } : null
  }

  function requireSession(req) {
    const s = currentSession(req)
    if (!s) throw new HttpError(401, 'Sign in first.')
    return s
  }

  function startSession(astronautId) {
    const { token, session } = sessions.create(astronautId)
    return { session, cookie: sessionCookie(token) }
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
      return { status: 200, body: { session: { astronautId: s.astronautId, expiresAt: s.expiresAt } } }
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
      if (id !== me.astronautId && me.role !== CMO_ROLE) {
        throw new HttpError(403, 'You can only open your own readings.')
      }
      return { status: 200, body: q.readings.all(id).map(readingOut) }
    },

    'POST /api/readings': ({ body, req }) => {
      const me = requireSession(req)
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

    'DELETE /api/astronauts/:id': ({ params, body, req }) => {
      const row = q.get.get(params.id)
      if (!row) throw new HttpError(404, 'Astronaut not found')
      const byOwner = pinMatches(body?.pin, row.pin_hash, row.pin_salt)
      const byAdmin = typeof body?.pin === 'string' && body.pin === ADMIN_PIN
      if (!byOwner && !byAdmin) throw new HttpError(403, 'PIN not accepted. Use this astronaut’s PIN or the admin PIN.')
      q.remove.run(row.id)
      q.removeReadings.run(row.id)
      q.clearAttempts.run(row.id)
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
