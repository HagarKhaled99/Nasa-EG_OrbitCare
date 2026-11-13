import { STATUS_RANK, worstStatus, type IndicatorState, type OrganState, type Status } from './health'
import { RADIATION_CAREER_LIMIT, type IndicatorId, type IndicatorMeta, type MeasuredIndicatorId } from './indicators'
import { READING_SOURCE } from './sensors'
import type { ShownStatus } from './status-style'

/* ---------- Missing data: never silently "normal" ---------- */

export function isUnknown(indicator: IndicatorState) {
  return (
    !Number.isFinite(indicator.value) ||
    !Number.isFinite(indicator.baseline) ||
    indicator.history.length === 0 ||
    indicator.history.every((p) => !Number.isFinite(p.value))
  )
}

export function indicatorShownStatus(indicator: IndicatorState): ShownStatus {
  return isUnknown(indicator) ? 'unknown' : indicator.status
}

/**
 * Worst known status wins (a real warning is more urgent than a gap).
 * If anything is missing and nothing known is flagged, the organ is Unknown, not Normal.
 */
export function organShownStatus(state: OrganState): ShownStatus {
  const known = state.indicators.filter((i) => !isUnknown(i))
  if (known.length === 0) return 'unknown'
  const worst = worstStatus(known.map((i) => i.status))
  if (worst === 'normal' && known.length < state.indicators.length) return 'unknown'
  return worst
}

/* ---------- Where each number comes from ---------- */

const MANUAL_MEASURES: IndicatorId[] = ['systolic', 'diastolic', 'temperature']

export function sourceLabel(id: IndicatorId) {
  if (MANUAL_MEASURES.includes(id)) return 'Manual check-in (cuff / thermometer)'
  if (id === 'boneDensity' || id === 'muscleMass') return 'Twin model estimate (illustrative)'
  if (id === 'radiationDose') return 'Simulated dosimeter'
  if (id === 'crewPulse') return 'Private crew votes'
  const source = READING_SOURCE[id as MeasuredIndicatorId]
  if (source === 'watch') return 'Simulated watch'
  if (source === 'patch') return 'Simulated patch sensor'
  return 'Manual check-in'
}

/* ---------- Plain-English trend caption under every graph ---------- */

export function trendSentence(indicator: IndicatorState) {
  const values = indicator.history.map((p) => p.value).filter(Number.isFinite)
  if (values.length < 8) return 'Not enough readings yet to describe a trend.'
  if (indicator.id === 'radiationDose') {
    return 'Dose only goes up. The steeper the line, the faster you are using your career limit.'
  }
  const recent = values.slice(-7)
  const earlier = values.slice(0, -7)
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const base = avg(earlier)
  if (base === 0) return 'Steady over the last 30 days.'
  const change = (avg(recent) - base) / base
  const pct = Math.abs(change) * 100
  if (pct < 2) return 'Steady over the last 30 days. Your last week looks like the weeks before it.'
  const direction = change > 0 ? 'higher' : 'lower'
  const rounded = pct < 10 ? pct.toFixed(1) : String(Math.round(pct))
  return `Your last 7 days average ${rounded}% ${direction} than the 3 weeks before.`
}

/* ---------- The four plain-English answers ---------- */

export interface OrganAnswers {
  changed: { headline: string; lines: { label: string; text: string; status: ShownStatus }[] }
  why: { text: string; about: string }
  serious: { status: ShownStatus; headline: string; detail: string }
  todo: { status: Status; steps: string[]; needsCheckIn: boolean }
}

const SERIOUS_COPY: Record<ShownStatus, { headline: string; detail: string }> = {
  normal: {
    headline: 'Not serious',
    detail: 'Everything we can see is inside your personal range. Keep up your routine.',
  },
  watch: {
    headline: 'Keep an eye on it',
    detail: 'Worth acting on today, but not an emergency. If it gets worse or lasts, tell your crew medical officer.',
  },
  act: {
    headline: 'Needs action now',
    detail: 'This is outside your safe range. Follow the steps and contact the right person straight away.',
  },
  unknown: {
    headline: 'Cannot tell yet',
    detail: 'We are missing data, so we do not call this normal. Take the reading to get a real answer.',
  },
}

export function buildAnswers(state: OrganState): OrganAnswers {
  const { organ, indicators } = state
  const shown = organShownStatus(state)
  const known = indicators.filter((i) => !isUnknown(i))
  const missing = indicators.filter(isUnknown)
  const flagged = known.filter((i) => i.status !== 'normal')

  // What changed
  let headline: string
  if (known.length === 0) headline = 'We have no readings for this system yet.'
  else if (flagged.length > 0)
    headline = `${flagged.length} of ${indicators.length} readings moved away from your normal.`
  else if (missing.length > 0) headline = 'The readings we have are normal, but some are missing.'
  else headline = 'Nothing has moved away from your normal.'

  const lines = [
    ...flagged
      .sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status])
      .map((i) => ({ label: i.meta.label, text: i.message, status: i.status as ShownStatus })),
    ...missing.map((i) => ({
      label: i.meta.label,
      text: 'No reading yet.',
      status: 'unknown' as ShownStatus,
    })),
  ]

  // Why it matters: explain the reading that is furthest from normal, else the first one
  const focus =
    [...flagged].sort(
      (a, b) =>
        STATUS_RANK[b.status] - STATUS_RANK[a.status] || Math.abs(b.deviation) - Math.abs(a.deviation),
    )[0] ?? known[0] ?? indicators[0]

  // What to do
  const todoStatus: Status = known.length ? worstStatus(known.map((i) => i.status)) : 'normal'
  const steps = organ.actions[todoStatus]

  return {
    changed: { headline, lines },
    why: { text: focus.meta.why, about: focus.meta.label },
    serious: { status: shown, ...SERIOUS_COPY[shown] },
    todo: { status: todoStatus, steps, needsCheckIn: missing.length > 0 },
  }
}

/* ---------- The rule behind each status, shown next to the number ---------- */


const pct = (x: number) => `${Math.round(x * 1000) / 10}%`

export function ruleSentence(meta: IndicatorMeta) {
  if (meta.id === 'crewPulse') return 'Watch when 2 crewmates flag a change. Act when 3 or more do.'
  if (meta.id === 'radiationDose')
    return `Watch at ${pct(meta.watchPct)} of the ${RADIATION_CAREER_LIMIT} mSv career limit. Act at ${pct(meta.actPct)}.`
  const where = meta.id === 'boneDensity' || meta.id === 'muscleMass' ? 'pre-flight value' : 'normal'
  const dir = meta.bad === 'low' ? 'below' : meta.bad === 'high' ? 'above' : 'away from'
  const base = `Watch at ${pct(meta.watchPct)} ${dir} your ${where}. Act at ${pct(meta.actPct)}.`
  const hard: string[] = []
  if (meta.id !== 'mood' && meta.hardMin !== undefined) hard.push(`below ${meta.hardMin} ${meta.unit}`)
  if (meta.hardMax !== undefined) hard.push(`above ${meta.hardMax} ${meta.unit}`)
  return hard.length ? `${base} Always Act ${hard.join(' or ')}.` : base
}
