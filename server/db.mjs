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

    CREATE TABLE IF NOT EXISTS sign_in_attempts (
      astronaut_id TEXT PRIMARY KEY REFERENCES astronauts(id) ON DELETE CASCADE,
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
      note                          TEXT
    );
    CREATE INDEX IF NOT EXISTS readings_by_astronaut ON readings (astronaut_id, mission_day);

    CREATE TABLE IF NOT EXISTS audit_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      at           TEXT NOT NULL,
      action       TEXT NOT NULL,                     -- create | delete | sign-in-ok | sign-in-fail | locked
      astronaut_id TEXT,
      detail       TEXT
    );
  `)
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
