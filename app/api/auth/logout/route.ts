import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/orbit/server/session'

/** POST /api/auth/logout: ends the session on this tablet. */
export function POST() {
  const response = NextResponse.json({ ok: true })
  clearSessionCookie(response)
  return response
}
