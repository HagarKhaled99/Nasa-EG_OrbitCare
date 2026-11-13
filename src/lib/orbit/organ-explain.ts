import { STATUS_RANK, worstStatus, type IndicatorState, type OrganState, type Status } from './health'
import { RADIATION_CAREER_LIMIT, type IndicatorId, type IndicatorMeta, type MeasuredIndicatorId } from './indicators'
import { READING_SOURCE } from './sensors'
import type { ShownStatus } from './status-style'
import type { SymptomDef } from './symptoms'

const SHOWN_RANK: Record<ShownStatus, number> = { normal: 0, unknown: 1, watch: 2, act: 3 }

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
  let shown: ShownStatus
  if (known.length === 0) shown = 'unknown'
  else {
    const worst = worstStatus(known.map((i) => i.status))
    shown = worst === 'normal' && known.length < state.indicators.length ? 'unknown' : worst
  }
  // state.status already includes symptoms reported at check-in (OrbitProvider): an urgent symptom raises it.
  return SHOWN_RANK[state.status] > SHOWN_RANK[shown] ? state.status : shown
}

/* ---------- Where each number comes from ---------- */

export function sourceLabel(id: IndicatorId) {
  if (id === 'boneDensity' || id === 'muscleMass') return 'Twin model estimate (illustrative)'
  if (id === 'radiationDose') return 'Simulated personal dosimeter (not the watch)'
  if (id === 'crewPulse') return 'Private crew votes'
  const source = READING_SOURCE[id as MeasuredIndicatorId]
  if (source === 'watch') return id === 'spo2' ? 'Simulated watch (optical SpO₂, proposed design)' : 'Simulated watch'
  if (source === 'cuff') return 'Manual check-in (arm cuff)'
  if (source === 'thermometer') return 'Manual check-in (thermometer)'
  if (source === 'meter') return 'Manual check-in (fingerstick meter)'
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

export function buildAnswers(state: OrganState, symptoms: SymptomDef[] = []): OrganAnswers {
  const { organ, indicators } = state
  const shown = organShownStatus(state)
  const known = indicators.filter((i) => !isUnknown(i))
  const missing = indicators.filter(isUnknown)
  const flagged = known.filter((i) => i.status !== 'normal')

  // What changed
  let headline: string
  const urgent = symptoms.filter((s) => s.level === 'act')
  if (urgent.length > 0) headline = `You reported ${urgent.map((s) => s.label.toLowerCase()).join(', ')} today.`
  else if (known.length === 0) headline = 'We have no readings for this system yet.'
  else if (flagged.length > 0)
    headline = `${flagged.length} of ${indicators.length} readings moved away from your normal.`
  else if (missing.length > 0) headline = 'The readings we have are normal, but some are missing.'
  else headline = 'Nothing has moved away from your normal.'

  const lines = [
    ...symptoms.map((s) => ({ label: s.label, text: `Reported at check-in. ${s.why}`, status: s.level as ShownStatus })),
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
  const todoStatus: Status = worstStatus([...known.map((i) => i.status), ...symptoms.map((s) => s.level)])
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
