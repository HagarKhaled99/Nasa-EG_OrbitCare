
// ORBIT TWIN crew database (SQLite, built into Node >= 22.5 as node:sqlite).
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
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL,
      dob TEXT NOT NULL,
      mission_id TEXT NOT NULL,
      figure TEXT NOT NULL CHECK (figure IN ('female', 'male')),
      pin_hash TEXT NOT NULL,
      pin_salt TEXT NOT NULL,
      watch_serial TEXT,
      dosimeter_serial TEXT,
      baseline_json TEXT NOT NULL,
      baseline_source_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sign_in_attempts (
      astronaut_id TEXT PRIMARY KEY REFERENCES astronauts(id) ON DELETE CASCADE,
      failed INTEGER NOT NULL DEFAULT 0,
      locked_until INTEGER
    );

    -- Daily health readings.
    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      timestamp_utc TEXT NOT NULL,
      mission_day INTEGER NOT NULL,
      heart_rate_bpm REAL,
      spo2_pct REAL,
      blood_pressure_systolic_mmhg REAL,
      blood_pressure_diastolic_mmhg REAL,
      temperature_c REAL,
      sleep_hours REAL,
      mood_1_to_5 INTEGER,
      activity_min REAL,
      radiation_dose_msv_daily REAL,
      data_origin TEXT NOT NULL,
      sensor_mode TEXT,
      quality TEXT,
      note TEXT
    );

    CREATE INDEX IF NOT EXISTS readings_by_astronaut
      ON readings (astronaut_id, mission_day);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      action TEXT NOT NULL,
      astronaut_id TEXT,
      detail TEXT
    );

    -- Member 5: saved Action Center checklist progress.
    CREATE TABLE IF NOT EXISTS action_step_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      alert_key TEXT NOT NULL,
      step_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE (astronaut_id, alert_key, step_id)
    );

    -- Member 5: medical officer notifications.
    CREATE TABLE IF NOT EXISTS medical_notifications (
      id TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      alert_key TEXT NOT NULL,
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    -- Member 5: generated medical reports.
    CREATE TABLE IF NOT EXISTS medical_reports (
      id TEXT PRIMARY KEY,
      astronaut_id TEXT NOT NULL,
      report_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL
    );

    -- Member 5: daily Crew Pulse votes.
    CREATE TABLE IF NOT EXISTS crew_pulse_votes (
      id TEXT PRIMARY KEY,
      mission_day INTEGER NOT NULL,
      from_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      seems_like_themselves INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (mission_day, from_id, target_id)
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
    devices: {
      watch: row.watch_serial ?? null,
      dosimeter: row.dosimeter_serial ?? null,
    },
    baseline: JSON.parse(row.baseline_json),
    baselineSource: JSON.parse(row.baseline_source_json),
    createdAt: row.created_at,
  }
}
