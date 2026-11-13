import { NextResponse, type NextRequest } from 'next/server'
import { astronautFromProfile } from '@/lib/orbit/accounts'
import { ENVIRONMENTS, type EnvironmentId } from '@/lib/orbit/environments'
import { listProfiles } from '@/lib/orbit/server/accounts-store'
import { getSessionProfile } from '@/lib/orbit/server/session'
import { DATA_LABEL, computeTwinSnapshot, crewOverview } from '@/lib/orbit/twin'

/**
 * Twin View API (Member 2). You must be signed in.
 *
 *   GET /api/twin               → YOUR twin, in your mission's environment
 *   GET /api/twin?env=iss       → your twin as if you were on the ISS
 *   GET /api/twin?blackout=1    → demo: the Mars solar-conjunction blackout starts today
 *   GET /api/twin?crew=1        → status of the whole crew (crew medical officer only)
 *
 * Asking for anyone else's twin (?astronaut=other) returns 403. Nobody can read
 * another person's account. All values are SYNTHETIC_DEMO.
 */
export function GET(request: NextRequest) {
  const me = getSessionProfile(request)
  if (!me) return NextResponse.json({ error: 'Sign in to see your twin.' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const envParam = params.get('env') ?? me.environmentId
  if (!ENVIRONMENTS.some((e) => e.id === envParam)) {
    return NextResponse.json(
      { error: `Unknown env "${envParam}"`, valid: ENVIRONMENTS.map((e) => e.id) },
      { status: 400 },
    )
  }
  const envId = envParam as EnvironmentId

  const asked = params.get('astronaut')
  if (asked && asked !== me.id) {
    return NextResponse.json({ error: 'You can only open your own twin.' }, { status: 403 })
  }

  if (params.get('crew')) {
    if (me.role !== 'Crew Medical Officer') {
      return NextResponse.json({ error: 'Only the crew medical officer can see the crew overview.' }, { status: 403 })
    }
    const crew = crewOverview(listProfiles().map(astronautFromProfile), envId)
    return NextResponse.json({ dataLabel: DATA_LABEL, env: envId, crew }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const forceBlackout = params.get('blackout') === '1'
  return NextResponse.json(computeTwinSnapshot(astronautFromProfile(me), envId, undefined, { forceBlackout }), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
