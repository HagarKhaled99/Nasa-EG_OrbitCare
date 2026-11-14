// Crew server tests: sign-in and sessions, privacy, sign-up validation, readings, symptoms, Member 5 API,
// demo reset and database upgrades. Each test run uses a fresh in-memory database.
import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApi } from '../server/server.mjs'
import { openDatabase } from '../server/db.mjs'

function startTestServer() {
  const server = createServer(createApi(openDatabase(':memory:'), { dbPath: ':memory:' }))
  return new Promise((resolve) => server.listen(0, () => resolve(server)))
}

/** A tiny "browser" that keeps the session cookie between requests. */
function browser(port) {
  let cookie = ''
  return async (method, path, body, headers = {}) => {
    const res = await fetch(`http://localhost:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0]
    return { s: res.status, b: res.status === 204 ? null : await res.json(), set }
  }
}

const NOUR = {
  name: 'Nour Adel',
  role: 'Flight Engineer',
  dob: '1990-02-02',
  missionId: 'iss',
  figure: 'female',
  pin: '4827',
  devices: { watch: 'OW-2231', dosimeter: null },
  baseline: { heartRate: 58, spo2: 98, sleep: 7.4, systolic: 112, diastolic: 72, temperature: 36.6 },
  baselineSource: { heartRate: 'watch-preflight' },
}

export async function run(t) {
  const server = await startTestServer()
  const port = server.address().port
  const anon = browser(port)
  const sara = browser(port)
  const lena = browser(port)
  const nour = browser(port)
  let r

  // ---------- sign-in and sessions ----------
  r = await anon('GET', '/api/auth/session')
  t('no cookie → not signed in (401)', r.s === 401, r)
  r = await sara('POST', '/api/auth/sign-in', { astronautId: 'sara', pin: '1111' })
  t('wrong PIN → 401 with tries left', r.s === 401 && r.b.attemptsLeft === 4, r)
  r = await sara('POST', '/api/auth/sign-in', { astronautId: 'sara', pin: '2026' })
  t('demo PIN → 200 + httpOnly SameSite cookie', r.s === 200 && /HttpOnly/.test(r.set) && /SameSite=Lax/.test(r.set), r)
  r = await sara('GET', '/api/auth/session')
  t('session belongs to Sara', r.b.session?.astronautId === 'sara', r)
  for (let i = 0; i < 5; i++) r = await anon('POST', '/api/auth/sign-in', { astronautId: 'omar', pin: '0000' })
  t('5 wrong PINs → locked (423)', r.s === 423, r)
  r = await anon('POST', '/api/auth/sign-in', { astronautId: 'omar', pin: '2026' })
  t('right PIN refused while locked', r.s === 423, r)

  // forged cookie: change the astronaut id inside a valid token
  const signed = await fetch(`http://localhost:${port}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ astronautId: 'ahmed', pin: '2026' }),
  })
  const token = decodeURIComponent(signed.headers.get('set-cookie').split(';')[0].split('=')[1])
  const [payload, sig] = token.split('.')
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
  const forged = `${Buffer.from(JSON.stringify({ ...data, sub: 'lena' })).toString('base64url')}.${sig}`
  r = await anon('GET', '/api/auth/session', null, { Cookie: `orbit_session=${encodeURIComponent(forged)}` })
  t('forged cookie (ahmed → lena) rejected', r.s === 401, r)

  // ---------- sign-up ----------
  r = await nour('POST', '/api/astronauts', { ...NOUR, name: 'X', pin: '1234', dob: '2015-01-01', baseline: { ...NOUR.baseline, heartRate: 300 } })
  t('bad sign-up data → 400 with the reasons', r.s === 400 && r.b.errors.length >= 4, r)
  r = await nour('POST', '/api/astronauts', { ...NOUR, name: 'Sara Haddad' })
  t('sample-crew name refused', r.s === 400, r)
  r = await nour('POST', '/api/astronauts', NOUR)
  const nourId = r.b.id
  t('sign-up → 201, signed in, no PIN hash returned', r.s === 201 && r.b.session?.astronautId === nourId && !JSON.stringify(r.b).includes('pin_'), r)
  r = await nour('POST', '/api/astronauts', { ...NOUR, name: 'nour adel' })
  t('duplicate name → 409', r.s === 409, r)

  // ---------- readings and privacy ----------
  r = await sara('GET', '/api/readings?astronautId=sara')
  t('own readings: 31 SYNTHETIC_DEMO days', r.s === 200 && r.b.length === 31 && r.b.every((x) => x.data_origin === 'SYNTHETIC_DEMO'), r.s)
  r = await sara('GET', '/api/readings?astronautId=omar')
  t("someone else's readings → 403", r.s === 403, r)
  await lena('POST', '/api/auth/sign-in', { astronautId: 'lena', pin: '2026' })
  r = await lena('GET', '/api/readings?astronautId=lena')
  t('Lena day 214: SpO₂ missing (no-signal) → must show Unknown', r.b[30].spo2_pct === null && r.b[30].quality === 'no-signal', r.b[30])
  r = await lena('GET', '/api/readings?astronautId=sara')
  t('crew medical officer may read others', r.s === 200, r)
  r = await lena('GET', '/api/readings?astronautId=omar')
  t('Omar starts healthy: day-214 SpO₂ ≥ 95 % (his emergency is injected live in the demo)', r.b[30].spo2_pct >= 95, r.b[30])
  r = await sara('POST', '/api/readings', { astronaut_id: 'omar', mission_day: 214, heart_rate_bpm: 60, data_origin: 'MANUAL_CHECKIN' })
  t('cannot write into another twin → 403', r.s === 403, r)
  r = await sara('POST', '/api/readings', {
    astronaut_id: 'sara',
    mission_day: 214,
    data_origin: 'MANUAL_CHECKIN',
    sensor_mode: 'manual',
    blood_pressure_systolic_mmhg: 118,
    blood_pressure_diastolic_mmhg: 74,
    glucose_mg_dl: 92,
    grip_kg: 37,
    vision_lines: 10,
    symptoms: ['headache'],
  })
  t('check-in with BP, glucose, grip, vision and symptoms → 201', r.s === 201 && r.b.grip_kg === 37 && r.b.symptoms[0] === 'headache', r)
  r = await sara('POST', '/api/readings', { astronaut_id: 'sara', mission_day: 214, heart_rate_bpm: 400, data_origin: 'SYNTHETIC_DEMO' })
  t('impossible value + fake origin → 400', r.s === 400 && r.b.errors.length === 2, r)
  r = await sara('POST', '/api/readings', { astronaut_id: 'sara', mission_day: 214, data_origin: 'MANUAL_CHECKIN', symptoms: ['made-up'] })
  t('unknown symptom → 400', r.s === 400, r)

  // ---------- Member 5: action center + crew pulse ----------
  for (const path of ['/api/action-steps', '/api/medical-notifications', '/api/medical-reports', '/api/crew-pulse?missionDay=214']) {
    r = await anon('GET', path)
    t(`${path.split('?')[0]} needs sign-in`, r.s === 401, r)
  }
  r = await sara('GET', '/api/crew-pulse?missionDay=214')
  t('Crew Pulse: Sara gets only counts (2 of 3), never who', r.b.aboutMe.flags === 2 && r.b.aboutMe.total === 3 && !('votes' in r.b), r.b)
  r = await sara('POST', '/api/crew-pulse', { missionDay: 214, targetId: 'ahmed', seemsLikeThemselves: false, fromId: 'omar' })
  t('vote is stored as the signed-in person (fromId in body ignored)', r.s === 200, r)
  r = await sara('POST', '/api/crew-pulse', { missionDay: 214, targetId: 'sara', seemsLikeThemselves: true })
  t('cannot answer about yourself', r.s === 400, r)
  r = await sara('POST', '/api/action-steps', { alertKey: 'heart-day214-act', stepId: '__ack__', completed: true, astronautId: 'omar' })
  t('acknowledgment saved', r.s === 200, r)
  r = await nour('GET', '/api/action-steps')
  t("others never see Sara's steps", r.b.length === 0, r.b)
  r = await sara('POST', '/api/medical-notifications', { alertKey: 'heart-day214-act', recipient: 'Crew medical officer' })
  t('notify medical officer → queued', r.s === 201 && r.b.status === 'queued', r)
  r = await sara('POST', '/api/medical-reports', { report: { text: 'packet' } })
  t('report packet → queued', r.s === 201, r)
  r = await lena('GET', '/api/medical-reports')
  t('crew medical officer receives report packets', r.b.length === 1, r.b)

  // ---------- ground portal (Earth) ----------
  const surgeon = browser(port)
  const director = browser(port)
  r = await surgeon('POST', '/api/auth/sign-in', { astronautId: 'ground-surgeon', pin: '2026' })
  t('flight surgeon signs in', r.s === 200, r)
  r = await surgeon('GET', '/api/auth/session')
  t('session says ground team, medical access', r.b.session.kind === 'ground' && r.b.session.access === 'medical', r.b)
  await director('POST', '/api/auth/sign-in', { astronautId: 'ground-director', pin: '2026' })
  r = await surgeon('GET', '/api/ground/crew')
  t('surgeon crew overview lists the crew with report counts', r.s === 200 && r.b.some((c) => c.id === 'omar') && 'reportsArrived' in r.b[0], r.b[0])
  r = await director('GET', '/api/ground/crew')
  t('director overview has NO medical fields', r.s === 200 && !('reportsArrived' in r.b[0]), r.b[0])
  r = await director('GET', '/api/readings?astronautId=sara')
  t('director cannot read vitals → 403', r.s === 403, r)
  r = await director('GET', '/api/ground/messages?astronautId=sara')
  t('director cannot read the medical thread → 403', r.s === 403, r)
  r = await surgeon('GET', '/api/readings?astronautId=sara')
  t('surgeon can read vitals', r.s === 200, r.s)
  r = await surgeon('GET', '/api/crew-pulse?missionDay=214')
  t('Crew Pulse never leaves the station (ground → 403)', r.s === 403, r)
  r = await surgeon('POST', '/api/readings', { astronaut_id: 'sara', mission_day: 214, heart_rate_bpm: 60, data_origin: 'MANUAL_CHECKIN' })
  t('ground cannot write astronaut readings', r.s === 403, r)
  r = await surgeon('GET', '/api/ground/messages?astronautId=sara')
  t('Sara’s report packet is still crossing space (Mars ≈ 18 min)', r.b.delaySeconds === 1080 && r.b.reports.length === 1 && r.b.reports[0].arrived === false && r.b.reports[0].report === null, r.b)
  r = await surgeon('POST', '/api/ground/messages', { astronautId: 'sara', body: 'Drink 500 mL now and re-measure tonight.' })
  t('surgeon sends advice; it arrives after the one-way delay', r.s === 201 && Date.parse(r.b.arrives_at) - Date.parse(r.b.sent_at) === 1080 * 1000, r.b)
  r = await director('POST', '/api/ground/messages', { astronautId: 'sara', body: 'hi' })
  t('director cannot send medical advice', r.s === 403, r)
  r = await sara('GET', '/api/inbox')
  t('Sara sees the advice is on its way but cannot read it yet', r.b.messages.length === 1 && r.b.messages[0].arrived === false && r.b.messages[0].body === null, r.b.messages)
  r = await surgeon('POST', '/api/ground/fitness', { astronautId: 'sara', status: 'limited', restrictions: 'No EVA until cleared', medicalNote: 'Resting HR +24 %, poor sleep' })
  t('surgeon sets fitness for duty', r.s === 201, r)
  r = await director('GET', '/api/ground/crew')
  const saraRow = r.b.find((c) => c.id === 'sara')
  t('director sees "limited · No EVA" but not the medical note', saraRow.fitness.status === 'limited' && saraRow.fitness.restrictions === 'No EVA until cleared' && !JSON.stringify(r.b).includes('Resting HR'), saraRow)
  r = await director('GET', '/api/ground/fitness?astronautId=sara')
  t('director fitness history has no medical note', r.b.length === 1 && r.b[0].medical_note === undefined, r.b)
  r = await director('POST', '/api/ground/fitness', { astronautId: 'sara', status: 'ready' })
  t('only the flight surgeon decides fitness', r.s === 403, r)
  r = await sara('POST', '/api/demo/fast-forward')
  t('demo fast-forward delivers Sara’s in-transit items', r.s === 200 && r.b.messages === 1 && r.b.reports === 1, r.b)
  r = await sara('GET', '/api/inbox')
  t('advice arrived; Sara sees her fitness and the doctor’s note', r.b.messages[0].arrived && r.b.messages[0].body.startsWith('Drink') && r.b.fitness.status === 'limited' && r.b.fitness.medical_note, r.b)
  r = await sara('POST', `/api/inbox/${r.b.messages[0].id}/read`)
  t('Sara marks the advice as read', r.b.changed === 1, r.b)
  r = await surgeon('GET', '/api/ground/messages?astronautId=sara')
  t('surgeon now reads the arrived packet and sees the advice was read', r.b.reports[0].arrived && r.b.reports[0].report.text === 'packet' && r.b.messages[0].read_at, r.b)
  r = await lena('GET', '/api/inbox')
  t('other astronauts do not get Sara’s advice', r.b.messages.length === 0, r.b)
  r = await surgeon('POST', '/api/demo/reset')
  t('ground staff cannot use the astronaut demo reset', r.s === 403, r)

  // ---------- top-bar environment sets the light delay ----------
  r = await sara('POST', '/api/environment', { environmentId: 'iss' })
  t('astronaut switches to ISS → server delay 0.5 s', r.s === 200 && r.b.delaySeconds === 0.5, r)
  r = await sara('GET', '/api/inbox')
  t('inbox now reports the ISS delay', r.b.delaySeconds === 0.5, r.b.delaySeconds)
  r = await sara('POST', '/api/environment', { environmentId: 'pluto' })
  t('unknown environment → 400', r.s === 400, r)
  r = await surgeon('POST', '/api/environment', { environmentId: 'iss' })
  t('ground staff cannot set an astronaut environment', r.s === 403, r)
  r = await sara('POST', '/api/environment', { environmentId: 'mars-transit' })
  t('back to Mars transit → 18 min', r.b.delaySeconds === 1080, r.b)

  // ---------- demo reset (rehearsals) ----------
  r = await sara('POST', '/api/demo/reset')
  t('demo reset removes only my own non-demo data', r.s === 200 && r.b.removedReadings === 1, r)
  r = await sara('GET', '/api/readings?astronautId=sara')
  t('the 31 demo days are kept after reset', r.b.length === 31, r.b.length)
  r = await sara('GET', '/api/action-steps')
  t('my ticked steps are cleared by reset', r.b.length === 0, r.b)

  // ---------- admin: reset PIN, delete ----------
  r = await anon('POST', `/api/astronauts/${nourId}/reset-pin`, { adminPin: '1111', newPin: '5830' })
  t('reset PIN needs the admin PIN', r.s === 403, r)
  r = await anon('POST', `/api/astronauts/${nourId}/reset-pin`, { adminPin: '2026', newPin: '5830' })
  t('reset PIN with admin PIN → 204', r.s === 204, r)
  r = await nour('POST', '/api/auth/sign-in', { astronautId: nourId, pin: '5830' })
  t('new PIN works', r.s === 200, r)
  r = await nour('DELETE', `/api/astronauts/${nourId}`, { pin: '5830' })
  t('delete own profile → 204 and the session ends', r.s === 204 && /Max-Age=0/.test(r.set ?? ''), r)
  server.close()

  // ---------- database upgrade from an older version ----------
  const dir = mkdtempSync(join(tmpdir(), 'orbit-twin-test-'))
  const path = join(dir, 'old.db')
  const old = new DatabaseSync(path)
  old.exec(`CREATE TABLE readings (id INTEGER PRIMARY KEY AUTOINCREMENT, astronaut_id TEXT NOT NULL, timestamp_utc TEXT NOT NULL,
    mission_day INTEGER NOT NULL, heart_rate_bpm REAL, spo2_pct REAL, blood_pressure_systolic_mmhg REAL, blood_pressure_diastolic_mmhg REAL,
    temperature_c REAL, sleep_hours REAL, mood_1_to_5 INTEGER, activity_min REAL, radiation_dose_msv_daily REAL, data_origin TEXT NOT NULL,
    sensor_mode TEXT, quality TEXT, note TEXT);
    INSERT INTO readings (astronaut_id, timestamp_utc, mission_day, heart_rate_bpm, data_origin) VALUES ('sara', 'x', 200, 61, 'MANUAL_CHECKIN');`)
  old.close()
  const upgraded = openDatabase(path)
  const cols = upgraded.prepare('PRAGMA table_info(readings)').all().map((c) => c.name)
  t('old database gains the new columns', ['symptoms', 'glucose_mg_dl', 'grip_kg', 'vision_lines'].every((c) => cols.includes(c)), cols)
  t('existing rows are kept', upgraded.prepare('SELECT heart_rate_bpm FROM readings WHERE mission_day = 200').get()?.heart_rate_bpm === 61)
  upgraded.close()
  rmSync(dir, { recursive: true, force: true })
}
