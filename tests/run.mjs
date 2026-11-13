// `npm test`: runs the crew server tests and the app logic tests. No browser and no running server needed.
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
let passed = 0
const failures = []
const t = (name, ok, detail) => {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failures.push(name)
    console.log(`  ✗ ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail).slice(0, 400)}`}`)
  }
}

console.log('\nCrew server')
await (await import('./server.test.mjs')).run(t)

console.log('\nApp logic')
const out = mkdtempSync(join(tmpdir(), 'orbit-twin-tests-'))
try {
  const file = join(out, 'app.test.mjs')
  await build({
    entryPoints: [join(here, 'app.test.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: file,
    logLevel: 'error',
  })
  ;(await import(pathToFileURL(file).href)).run(t)
} finally {
  rmSync(out, { recursive: true, force: true })
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('Failed:\n' + failures.map((f) => `  - ${f}`).join('\n'))
  process.exit(1)
}
