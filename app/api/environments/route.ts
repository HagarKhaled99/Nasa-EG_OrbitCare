import { NextResponse, type NextRequest } from 'next/server'
import { astronautFromProfile } from '@/lib/orbit/accounts'
import { getEnvironment } from '@/lib/orbit/environments'
import { computeIndicators } from '@/lib/orbit/health'
import { getSessionProfile } from '@/lib/orbit/server/session'
import { DATA_LABEL, allEnvironmentEffects, exerciseRatioFrom } from '@/lib/orbit/twin'

/**
 * Environments API (Member 2). You must be signed in.
 *
 *   GET /api/environments        → every environment with its effects on YOU:
 *                                   delay, gravity, day cycle, radiation per day
 *                                   and over 30 days, bone and muscle loss per
 *                                   month at your exercise level, time to Earth,
 *                                   and who you contact.
 *   GET /api/environments?id=iss → just one environment.
 *
 * Illustrative, research-informed values (SYNTHETIC_DEMO), not predictions.
 */
export function GET(request: NextRequest) {
  const me = getSessionProfile(request)
  if (!me) return NextResponse.json({ error: 'Sign in to see environment effects.' }, { status: 401 })

  const astronaut = astronautFromProfile(me)
  const indicators = computeIndicators({
    astronaut,
    env: getEnvironment(me.environmentId),
    overrides: {},
    votes: astronaut.crewVotes,
  })
  const exerciseRatio = exerciseRatioFrom(indicators)
  const all = allEnvironmentEffects(exerciseRatio)

  const id = request.nextUrl.searchParams.get('id')
  if (id) {
    const one = all.find((e) => e.id === id)
    if (!one) return NextResponse.json({ error: `Unknown environment "${id}"`, valid: all.map((e) => e.id) }, { status: 404 })
    return NextResponse.json({ dataLabel: DATA_LABEL, exerciseRatio, environment: one })
  }

  return NextResponse.json(
    { dataLabel: DATA_LABEL, current: me.environmentId, exerciseRatio, environments: all },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
