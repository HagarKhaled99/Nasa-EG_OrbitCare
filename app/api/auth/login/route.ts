import { NextResponse, type NextRequest } from 'next/server'
import { verifyPin } from '@/lib/orbit/server/accounts-store'
import { setSessionCookie } from '@/lib/orbit/server/session'

/**
 * POST /api/auth/login  { astronautId, pin }
 * 200 { profile } and a session cookie, 401 wrong PIN, 423 locked after 5 tries.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { astronautId?: string; pin?: string }
  if (!body.astronautId || !body.pin) {
    return NextResponse.json({ error: 'Choose your profile and enter your PIN.' }, { status: 400 })
  }

  const result = verifyPin(String(body.astronautId), String(body.pin))
  if (!result.ok && result.reason === 'locked') {
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${Math.ceil(result.retryInSeconds / 60)} min.`, retryInSeconds: result.retryInSeconds },
      { status: 423 },
    )
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: `Wrong PIN. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`, attemptsLeft: result.attemptsLeft },
      { status: 401 },
    )
  }

  const response = NextResponse.json({ profile: result.profile })
  setSessionCookie(response, result.profile.id)
  return response
}
