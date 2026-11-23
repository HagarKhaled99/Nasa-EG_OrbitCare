// `npm run serve`: ONE process for online hosting (Render, Railway …). Serves the built website (dist/) and the
// crew database API (/api/...) on the same address and port, so the session cookie works without a proxy.
// Run `npm run build` first. Locally: `npm run build && npm run serve` → http://localhost:4000
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApi } from '../server/server.mjs'

const port = Number(process.env.PORT ?? 4000)
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const api = createApi()

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

async function sendFile(res, file, status = 200) {
  const body = await readFile(file)
  const type = TYPES[extname(file)] ?? 'application/octet-stream'
  // Hashed build files never change; pages and the service worker must always be fresh.
  const cache = file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': cache })
  res.end(body)
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost')
  if (pathname === '/api' || pathname.startsWith('/api/')) return api(req, res)
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    return res.end()
  }
  try {
    // Stay inside dist/ (no "../" tricks).
    const file = normalize(join(dist, decodeURIComponent(pathname)))
    if (file.startsWith(dist)) {
      const info = await stat(file).catch(() => null)
      if (info?.isFile()) return await sendFile(res, file)
    }
    // Any other path is a page of the app (/login, /ground/login …): React Router handles it.
    await sendFile(res, join(dist, 'index.html'))
  } catch (error) {
    console.error(error)
    res.writeHead(500)
    res.end('Server error. Did you run "npm run build" first?')
  }
})

server.listen(port, () => {
  console.log(`  ORBIT TWIN (website + crew API) → http://localhost:${port}`)
})
