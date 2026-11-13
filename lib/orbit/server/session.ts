/**
 * Sessions (SERVER ONLY: import this only from app/api route handlers).
 *
 * After a correct PIN the server sets an httpOnly cookie holding the account id,
 * an expiry, and an HMAC signature. Page scripts cannot read it, and changing
 * the id breaks the signature, so nobody can open another person's account by
 * editing the cookie.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { NextRequest, NextResponse } from 'next/server'
import type { AccountProfile } from '../accounts'
import { DATA_DIR, findProfile } from './accounts-store'

export const SESSION_COOKIE = 'orbit_session'
const MAX_AGE_SECONDS = 12 * 60 * 60 // one 12-hour shift

let secret: string | null = null

/** ORBIT_SESSION_SECRET if set, otherwise a random secret saved in the data dir. */
function getSecret() {
  if (secret) return secret
  if (process.env.ORBIT_SESSION_SECRET) return (secret = process.env.ORBIT_SESSION_SECRET)
  const file = path.join(DATA_DIR, 'session-secret')
  try {
    if (existsSync(file)) return (secret = readFileSync(file, 'utf8').trim())
    secret = randomBytes(32).toString('hex')
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, secret)
  } catch {
    secret = secret ?? randomBytes(32).toString('hex')
  }
  return secret
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createToken(accountId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: accountId, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function readToken(token: string | undefined): string | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number }
    if (!data.sub || !data.exp || data.exp < Date.now() / 1000) return null
    return data.sub
  } catch {
    return null
  }
}

/** The signed-in account for this request, or null. */
export function getSessionProfile(request: NextRequest): AccountProfile | null {
  const id = readToken(request.cookies.get(SESSION_COOKIE)?.value)
  return id ? findProfile(id) : null
}

export function setSessionCookie(response: NextResponse, accountId: string) {
  response.cookies.set(SESSION_COOKIE, createToken(accountId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 })
}
