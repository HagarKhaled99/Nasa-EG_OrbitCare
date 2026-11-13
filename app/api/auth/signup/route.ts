import { NextResponse, type NextRequest } from 'next/server'
import { createAccount, type SignUpInput } from '@/lib/orbit/server/accounts-store'
import { setSessionCookie } from '@/lib/orbit/server/session'

/**
 * POST /api/auth/signup  { name, role, figure, mission, pin }
 * 201 { profile } and a session cookie, or 400 with a plain-English error.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<SignUpInput>
  const result = createAccount({
    name: body.name ?? '',
    role: body.role ?? '',
    figure: body.figure ?? '',
    mission: body.mission ?? '',
    pin: body.pin ?? '',
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const response = NextResponse.json({ profile: result.profile }, { status: 201 })
  setSessionCookie(response, result.profile.id)
  return response
}
