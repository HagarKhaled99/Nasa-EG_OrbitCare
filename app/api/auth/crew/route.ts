import { NextResponse } from 'next/server'
import { listProfiles } from '@/lib/orbit/server/accounts-store'

/**
 * GET /api/auth/crew: who can sign in on this tablet (name, role, initials).
 * Public profile fields only. PINs and hashes never leave the server.
 */
export function GET() {
  const crew = listProfiles().map(({ id, name, role, initials, figure, lastCheckIn }) => ({
    id,
    name,
    role,
    initials,
    figure,
    lastCheckIn,
  }))
  return NextResponse.json({ crew }, { headers: { 'Cache-Control': 'no-store' } })
}
