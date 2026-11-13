// Server-side sessions (design by Member 2, Omar; rebuilt for the plain Node server).
//
// After a correct PIN the server sets an httpOnly cookie holding the astronaut id, an expiry and an HMAC
// signature. Page scripts cannot read it, and editing the id breaks the signature, so nobody can open
// another person's twin by changing the cookie or localStorage.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const SESSION_COOKIE = 'orbit_session'
export const SESSION_TTL_SECONDS = 12 * 60 * 60 // one 12-hour crew shift

/**
 * ORBIT_SESSION_SECRET if set; otherwise a random secret saved next to the database (git-ignored),
 * so sessions survive a server restart. In-memory databases (tests) get a throwaway secret.
 */
export function loadSecret(dbPath) {
  if (process.env.ORBIT_SESSION_SECRET) return process.env.ORBIT_SESSION_SECRET
  if (!dbPath || dbPath === ':memory:') return randomBytes(32).toString('hex')
  const file = join(dirname(dbPath), 'session-secret')
  try {
    if (existsSync(file)) return readFileSync(file, 'utf8').trim()
    const secret = randomBytes(32).toString('hex')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, secret)
    return secret
  } catch {
    return randomBytes(32).toString('hex')
  }
}

export function createSessions(secret) {
  const sign = (payload) => createHmac('sha256', secret).update(payload).digest('base64url')

  function create(astronautId, now = Date.now()) {
    const expiresAt = now + SESSION_TTL_SECONDS * 1000
    const payload = Buffer.from(JSON.stringify({ sub: astronautId, exp: expiresAt })).toString('base64url')
    return { token: `${payload}.${sign(payload)}`, session: { astronautId, signedInAt: now, expiresAt } }
  }

  /** Returns { astronautId, expiresAt } for a valid, unexpired token, else null. */
  function read(token, now = Date.now()) {
    if (!token) return null
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return null
    const expected = Buffer.from(sign(payload))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    try {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
      if (typeof data.sub !== 'string' || typeof data.exp !== 'number' || data.exp <= now) return null
      return { astronautId: data.sub, expiresAt: data.exp }
    } catch {
      return null
    }
  }

  return { create, read }
}

export function readCookie(req, name = SESSION_COOKIE) {
  const header = req.headers.cookie ?? ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
}
