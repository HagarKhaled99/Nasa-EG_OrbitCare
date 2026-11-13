// ORBIT TWIN crew database (SQLite, built into Node >= 22.5 as `node:sqlite`, no install needed).
// The database file lives in server/data/orbit-twin.db and is NOT committed to git:
// every teammate gets their own local database.
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const DB_PATH = process.env.ORBIT_DB_PATH ?? join(here, 'data', 'orbit-twin.db')

export function openDatabase(path = DB_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS astronauts (
      id                   TEXT PRIMARY KEY,
      name                 TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role                 TEXT NOT NULL,
      dob                  TEXT NOT NULL,              -- ISO yyyy-mm-dd
      mission_id           TEXT NOT NULL,              -- ares-iv | artemis | iss
      figure               TEXT NOT NULL CHECK (figure IN ('female', 'male')),
      pin_hash             TEXT NOT NULL,              -- scrypt, hex
      pin_salt             TEXT NOT NULL,
      watch_serial         TEXT,
      dosimeter_serial     TEXT,
      baseline_json        TEXT NOT NULL,              -- { heartRate: 58, spo2: 98, ... }
      baseline_source_json TEXT NOT NULL,              -- { heartRate: 'watch-preflight', ... }
      created_at           TEXT NOT NULL
    );

    -- Wrong-PIN counters for everyone who can sign in (sample crew too, so no foreign key).
    DROP TABLE IF EXISTS sign_in_attempts;             -- replaced by pin_attempts (v1 had a foreign key)
    CREATE TABLE IF NOT EXISTS pin_attempts (
      astronaut_id TEXT PRIMARY KEY,
      failed       INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER                            -- epoch ms, NULL = not locked
    );

    -- Daily vitals, one row per measurement event. Format = project plan §5 record format.
    -- astronaut_id is not a foreign key: the 4 sample crew live in the app code, not in 'astronauts'.
    -- NULL in a measurement column = missing, and the app must show it as UNKNOWN.
    CREATE TABLE IF NOT EXISTS readings (
      id                            INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id                  TEXT NOT NULL,
      timestamp_utc                 TEXT NOT NULL,
      mission_day                   INTEGER NOT NULL,
      heart_rate_bpm                REAL,
      spo2_pct                      REAL,
      blood_pressure_systolic_mmhg  REAL,
      blood_pressure_diastolic_mmhg REAL,
      temperature_c                 REAL,
      sleep_hours                   REAL,
      mood_1_to_5                   INTEGER,
      activity_min                  REAL,
      radiation_dose_msv_daily      REAL,
      data_origin                   TEXT NOT NULL,   -- SYNTHETIC_DEMO | SIMULATED_WATCH | MANUAL_CHECKIN
      sensor_mode                   TEXT,            -- rest | motion | manual
      quality                       TEXT,            -- good | poor | no-signal
      note                          TEXT,
      symptoms                      TEXT,            -- JSON array of symptom ids (check-in), NULL if none
      glucose_mg_dl                 REAL,            -- fingerstick meter (check-in)
      grip_kg                       REAL,            -- grip self-test (check-in)
      vision_lines                  REAL             -- near-vision card (check-in)
    );

    -- ---------- Ground portal (Earth) ----------
    -- Advice from the flight surgeon to one astronaut. It travels with the real one-way delay:
    -- shown to the astronaut only once arrives_at has passed.
    CREATE TABLE IF NOT EXISTS ground_messages (
      id           TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      from_id      TEXT NOT NULL,
      from_name    TEXT NOT NULL,
      body         TEXT NOT NULL,
      sent_at      TEXT NOT NULL,
      arrives_at   TEXT NOT NULL,
      read_at      TEXT
    );

    -- Fitness-for-duty decisions by the flight surgeon. The mission director sees status + restrictions only;
    -- medical_note is visible to the flight surgeon and the astronaut, never to management.
    CREATE TABLE IF NOT EXISTS fitness_decisions (
      id           TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      status       TEXT NOT NULL CHECK (status IN ('ready', 'limited', 'not-ready')),
      restrictions TEXT,
      medical_note TEXT,
      decided_by   TEXT NOT NULL,
      decided_at   TEXT NOT NULL
    );

    -- Small key/value table (e.g. which version of the demo dataset is loaded).
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS readings_by_astronaut ON readings (astronaut_id, mission_day);

    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      at           TEXT NOT NULL,
      action       TEXT NOT NULL,                     -- create | delete | sign-in-ok | sign-in-fail | locked
      astronaut_id TEXT,
      detail       TEXT
    );

    -- ---------- Member 5 (Salma): Action Center + Crew Pulse ----------
    -- Ticked "do this now" steps per alert (alert_key = organ-day-status, step_id = step text or '__ack__').
    CREATE TABLE IF NOT EXISTS action_step_state (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      alert_key    TEXT NOT NULL,
      step_id      TEXT NOT NULL,
      completed    INTEGER NOT NULL DEFAULT 0,
      updated_at   TEXT NOT NULL,
      UNIQUE (astronaut_id, alert_key, step_id)
    );

    -- "Notify the onboard medical officer" messages (queued until delivered).
    CREATE TABLE IF NOT EXISTS medical_notifications (
      id           TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      alert_key    TEXT NOT NULL,
      recipient    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      created_at   TEXT NOT NULL
    );

    -- Medical Report Packets (queued for the next comms window to Earth).
    CREATE TABLE IF NOT EXISTS medical_reports (
      id           TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      report_json  TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      created_at   TEXT NOT NULL
    );

    -- Daily Crew Pulse: "Does <crewmate> seem like their usual self today?" Private: only counts are shared.
    CREATE TABLE IF NOT EXISTS crew_pulse_votes (
      id                    TEXT PRIMARY KEY,
      mission_day           INTEGER NOT NULL,
      from_id               TEXT NOT NULL,
      target_id             TEXT NOT NULL,
      seems_like_themselves INTEGER NOT NULL,
      created_at            TEXT NOT NULL,
      UNIQUE (mission_day, from_id, target_id)
    );
  `)
  // Upgrade older databases: add columns that were introduced later (keeps existing rows).
  const reportColumns = db.prepare('PRAGMA table_info(medical_reports)').all().map((c) => c.name)
  if (!reportColumns.includes('arrives_at')) db.exec('ALTER TABLE medical_reports ADD COLUMN arrives_at TEXT')
  const readingColumns = db.prepare('PRAGMA table_info(readings)').all().map((c) => c.name)
  for (const [column, type] of [
    ['symptoms', 'TEXT'],
    ['glucose_mg_dl', 'REAL'],
    ['grip_kg', 'REAL'],
    ['vision_lines', 'REAL'],
  ]) {
    if (!readingColumns.includes(column)) db.exec(`ALTER TABLE readings ADD COLUMN ${column} ${type}`)
  }
  return db
}

/** Row → public JSON. Never includes the PIN hash or salt. */
export function toPublic(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    dob: row.dob,
    missionId: row.mission_id,
    figure: row.figure,
    devices: { watch: row.watch_serial ?? null, dosimeter: row.dosimeter_serial ?? null },
    baseline: JSON.parse(row.baseline_json),
    baselineSource: JSON.parse(row.baseline_source_json),
    createdAt: row.created_at,
  }
}
