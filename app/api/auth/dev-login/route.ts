import { NextResponse, type NextRequest } from 'next/server'
import { verifyPin } from '@/lib/orbit/server/accounts-store'
import { setSessionCookie } from '@/lib/orbit/server/session'

/**
 * TEMPORARY, development only (Member 2 testing). Not a page.
 *
 *   /api/auth/dev-login?astronaut=sara&pin=2468
 *
 * Checks the PIN like the real sign-in, then opens that person's Twin View.
 * Use it until Member 1's sign-in page calls signIn(). Delete this file after.
 * It is switched off in production builds.
 */
export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }
  const params = request.nextUrl.searchParams
  const result = verifyPin(params.get('astronaut') ?? '', params.get('pin') ?? '')
  if (!result.ok) {
    return NextResponse.json({ error: 'Wrong astronaut or PIN.' }, { status: 401 })
  }
  const response = NextResponse.redirect(new URL('/', request.url))
  setSessionCookie(response, result.profile.id)
  return response
}
