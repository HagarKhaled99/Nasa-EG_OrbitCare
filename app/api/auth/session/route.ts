import { NextResponse, type NextRequest } from 'next/server'
import { getSessionProfile } from '@/lib/orbit/server/session'

/** GET /api/auth/session: the signed-in account's profile, or 401. */
export function GET(request: NextRequest) {
  const profile = getSessionProfile(request)
  if (!profile) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  return NextResponse.json({ profile }, { headers: { 'Cache-Control': 'no-store' } })
}
