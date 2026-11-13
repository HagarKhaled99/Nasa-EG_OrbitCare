// `npm run data:generate`: rebuild the SYNTHETIC_DEMO dataset.
//   → public/data/orbit_twin_demo.json  (metadata + records; served by the app at /data/orbit_twin_demo.json)
//   → public/data/orbit_twin_demo.csv   (same records, opens in Excel)
//   → server/data/orbit-twin.db         (readings table: demo rows replaced, real check-ins kept)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, DB_PATH } from '../server/db.mjs'
import { DATASET_METADATA, READING_COLUMNS, generateDemoReadings, seedDemoReadings } from '../server/demo-data.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })

const records = generateDemoReadings()
writeFileSync(
  join(outDir, 'orbit_twin_demo.json'),
  JSON.stringify({ metadata: { ...DATASET_METADATA, records: records.length }, records }, null, 2) + '\n',
)

const cell = (v) => {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = [READING_COLUMNS.join(','), ...records.map((r) => READING_COLUMNS.map((c) => cell(r[c])).join(','))].join('\n')
writeFileSync(join(outDir, 'orbit_twin_demo.csv'), '\uFEFF' + csv + '\n') // BOM so Excel reads °/₂ correctly

const db = openDatabase()
const n = seedDemoReadings(db)
db.close()

console.log(`Generated ${records.length} SYNTHETIC_DEMO records (${DATASET_METADATA.astronauts.length} astronauts × ${records.length / DATASET_METADATA.astronauts.length} days)`)
console.log(`  public/data/orbit_twin_demo.json`)
console.log(`  public/data/orbit_twin_demo.csv`)
console.log(`  ${DB_PATH} → readings table (${n} demo rows)`)
