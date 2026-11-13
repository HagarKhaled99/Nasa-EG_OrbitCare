// `npm run db`: print the crew database as tables in the terminal (read-only, safe while the server runs).
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { DB_PATH } from '../server/db.mjs'

if (!existsSync(DB_PATH)) {
  console.log(`No database yet at ${DB_PATH}. Run "npm run dev" and sign up an astronaut first.`)
  process.exit(0)
}
const db = new DatabaseSync(DB_PATH, { readOnly: true })
console.log(`Database: ${DB_PATH}\n\n=== astronauts`)
const rows = db.prepare('SELECT * FROM astronauts ORDER BY created_at').all()
console.table(
  rows.map((r) => {
    const b = JSON.parse(r.baseline_json)
    return {
      name: r.name,
      role: r.role,
      dob: r.dob,
      mission: r.mission_id,
      watch: r.watch_serial ?? '-',
      HR: b.heartRate,
      SpO2: b.spo2,
      BP: `${b.systolic}/${b.diastolic}`,
      temp: b.temperature,
      sleep: b.sleep,
      added: r.created_at.slice(0, 16).replace('T', ' '),
    }
  }),
)
console.log('\n=== readings per astronaut')
console.table(
  db
    .prepare(
      `SELECT astronaut_id, data_origin, COUNT(*) AS rows, MIN(mission_day) AS first_day, MAX(mission_day) AS last_day,
              SUM(spo2_pct IS NULL) AS missing_spo2
       FROM readings GROUP BY astronaut_id, data_origin ORDER BY astronaut_id`,
    )
    .all(),
)
console.log('\n=== latest demo day')
console.table(
  db
    .prepare(
      `SELECT astronaut_id, heart_rate_bpm AS HR, spo2_pct AS SpO2,
              CAST(blood_pressure_systolic_mmhg AS INTEGER) || '/' || CAST(blood_pressure_diastolic_mmhg AS INTEGER) AS BP,
              temperature_c AS temp, sleep_hours AS sleep, mood_1_to_5 AS mood, activity_min AS activity, quality
       FROM readings
       WHERE data_origin = 'SYNTHETIC_DEMO' AND mission_day = (SELECT MAX(mission_day) FROM readings WHERE data_origin = 'SYNTHETIC_DEMO')
       ORDER BY astronaut_id`,
    )
    .all(),
)
console.log('\n=== audit_log (latest 20)')
console.table(db.prepare('SELECT at, action, detail FROM audit_log ORDER BY id DESC LIMIT 20').all())
const locked = db.prepare('SELECT a.name, s.failed, s.locked_until FROM sign_in_attempts s JOIN astronauts a ON a.id = s.astronaut_id').all()
if (locked.length) {
  console.log('\n=== failed sign-in attempts')
  console.table(locked)
}
