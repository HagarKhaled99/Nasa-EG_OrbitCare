/**
 * /ground/astronaut/:astronautId
 *  - Flight surgeon: body systems from the astronaut's readings (same science engine as on board), symptoms,
 *    report packets (readable once they reach Earth), advice with the light delay, fitness-for-duty decision.
 *  - Mission director: fitness for duty and restrictions only.
 * Crew Pulse is left out on purpose: it never leaves the station.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Loader2, Lock, Satellite, Send, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CREW, MISSION_DAY } from '@/lib/orbit/crew'
import { formatDelay, getEnvironment } from '@/lib/orbit/environments'
import { computeIndicators, computeOrgans, readinessScore, worstStatus } from '@/lib/orbit/health'
import { buildTwinSnapshot } from '@/lib/orbit/twin'
import { formatValue } from '@/lib/orbit/status-style'
import { SYMPTOMS, symptomLevels } from '@/lib/orbit/symptoms'
import { getMission, isSampleCrew, profileToAstronaut } from '@/lib/orbit/profiles'
import { fetchAstronauts } from '@/lib/orbit/api/crew-api'
import { fetchReadings, toReadingHistory, type Reading } from '@/lib/orbit/api/readings-api'
import {
  FITNESS_LABEL,
  arrivesIn,
  decideFitness,
  fetchFitnessHistory,
  fetchGroundCrew,
  fetchGroundThread,
  sendAdvice,
  type FitnessDecision,
  type FitnessStatus,
  type GroundCrewRow,
  type GroundMessage,
  type ReceivedReport,
} from '@/lib/orbit/api/ground-api'
import { FITNESS_STYLE } from '@/components/orbit/inbox'
import { StatusPill } from '@/components/orbit/status-pill'
import { useGround } from './ground-portal'

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function GroundAstronaut() {
  const { astronautId = '' } = useParams()
  const { isSurgeon } = useGround()
  const [row, setRow] = useState<GroundCrewRow | null>(null)
  const [crew, setCrew] = useState<GroundCrewRow[]>([])
  const [history, setHistory] = useState<FitnessDecision[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadBasics = useCallback(async () => {
    try {
      const all = await fetchGroundCrew()
      setCrew(all)
      setRow(all.find((c) => c.id === astronautId) ?? null)
      setHistory(await fetchFitnessHistory(astronautId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this astronaut')
    }
  }, [astronautId])

  useEffect(() => {
    void loadBasics()
  }, [loadBasics])

  if (error) {
    return (
      <p role="alert" className="rounded-xl border border-status-act/40 bg-status-act/10 p-4 text-sm">
        {error}
      </p>
    )
  }
  if (!row) return <p className="text-sm text-muted-foreground">Loading…</p>

  const fitness = history[0] ?? null
  const style = fitness ? FITNESS_STYLE[fitness.status] : null

  return (
    <div className="flex flex-col gap-6">
      <Link to="/ground" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Crew overview
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{row.name}</h1>
          <p className="text-muted-foreground">
            {row.role} · {getMission(row.missionId).label} · one-way delay {formatDelay(row.delaySeconds)}
          </p>
        </div>
        <p
          className={cn(
            'inline-flex items-center gap-2 rounded-full border px-4 py-2 font-medium',
            style ? style.tone : 'border-dashed border-border text-muted-foreground',
          )}
        >
          {style ? <style.icon className="size-4" aria-hidden /> : <ShieldCheck className="size-4" aria-hidden />}
          {fitness ? FITNESS_LABEL[fitness.status] : 'No fitness decision yet'}
          {fitness?.restrictions ? ` · ${fitness.restrictions}` : ''}
        </p>
      </header>

      {isSurgeon ? (
        <SurgeonFile row={row} onDecided={loadBasics} />
      ) : (
        <DirectorPlanning row={row} crew={crew} />
      )}

      <section aria-labelledby="history-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="history-title" className="font-semibold">
          Fitness-for-duty history
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No decisions yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {history.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border p-3 text-sm">
                <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', FITNESS_STYLE[d.status].tone)}>
                  {FITNESS_LABEL[d.status]}
                </span>
                {d.restrictions && <span>Restrictions: {d.restrictions}</span>}
                {isSurgeon && d.medical_note && <span className="text-muted-foreground">Note: {d.medical_note}</span>}
                <span className="ml-auto text-xs text-muted-foreground">
                  {d.decided_by} · {when(d.decided_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** Mission director: what the fitness decision means for planning, and who can take over. No medical data. */
function DirectorPlanning({ row, crew }: { row: GroundCrewRow; crew: GroundCrewRow[] }) {
  const first = row.name.split(' ')[0]
  const status = row.fitness?.status ?? null
  const available = crew.filter((c) => c.id !== row.id && c.fitness?.status !== 'limited' && c.fitness?.status !== 'not-ready')
  const meaning =
    status === 'not-ready'
      ? `${first} should not be scheduled for mission tasks until the flight surgeon clears them.`
      : status === 'limited'
        ? `${first} can work, but not on: ${row.fitness?.restrictions ?? 'the restricted tasks'}. Move those tasks to a crewmate below.`
        : status === 'ready'
          ? `${first} is cleared for all planned tasks.`
          : `The flight surgeon has not made a decision for ${first} today. Plan as usual and check again later.`

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="planning-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="planning-title" className="font-semibold">
          What this means for the mission
        </h2>
        <p className="mt-2 text-sm leading-relaxed">{meaning}</p>
        {(status === 'limited' || status === 'not-ready') && (
          <div className="mt-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Free to take over</p>
            {available.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No other crewmate is free. Talk to the flight surgeon.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {available.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2">
                    <span>
                      {c.name} · <span className="text-muted-foreground">{c.role}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{c.fitness ? FITNESS_LABEL[c.fitness.status] : 'no restrictions'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <p className="flex items-start gap-2 rounded-2xl border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        Medical details, report packets and advice stay between {first} and the flight surgeon. You see fitness for duty
        and restrictions only, so the crew can report symptoms without fear of being judged by management.
      </p>
    </div>
  )
}

function SurgeonFile({ row, onDecided }: { row: GroundCrewRow; onDecided: () => Promise<void> }) {
  const [readings, setReadings] = useState<Reading[] | null>(null)
  const [thread, setThread] = useState<{ delaySeconds: number; messages: GroundMessage[]; reports: ReceivedReport[] } | null>(
    null,
  )
  const [astronaut, setAstronaut] = useState(() => CREW.find((c) => c.id === row.id) ?? null)
  const [, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const [rows, t] = await Promise.all([fetchReadings(row.id), fetchGroundThread(row.id)])
      setReadings(rows)
      setThread(t)
      if (!isSampleCrew(row.id)) {
        const profile = (await fetchAstronauts()).find((p) => p.id === row.id)
        if (profile) setAstronaut(profileToAstronaut(profile))
      }
    } catch {
      /* keep what we have */
    }
  }, [row.id])

  useEffect(() => {
    void load()
    const refresh = window.setInterval(() => void load(), 15_000)
    const tick = window.setInterval(() => setTick((n) => n + 1), 5000) // "arrives in …" countdown
    return () => {
      window.clearInterval(refresh)
      window.clearInterval(tick)
    }
  }, [load])

  // Same science engine as on board, from the astronaut's mission environment. Crew Pulse is not shared with Earth.
  const summary = useMemo(() => {
    if (!astronaut || !readings) return null
    const env = getEnvironment(getMission(row.missionId).envId)
    const latestCheckIn = [...readings].reverse().find((r) => r.mission_day === MISSION_DAY && r.data_origin === 'MANUAL_CHECKIN')
    const symptoms = latestCheckIn?.symptoms ?? []
    const indicators = computeIndicators({
      astronaut,
      env,
      overrides: {},
      votes: [],
      readings: toReadingHistory(readings),
      inventHistory: isSampleCrew(row.id),
    })
    const reported = symptomLevels(symptoms)
    const organs = computeOrgans(indicators).map((o) => {
      const organ = { ...o.organ, indicators: o.organ.indicators.filter((i) => i !== 'crewPulse') }
      const states = o.indicators.filter((i) => i.id !== 'crewPulse')
      const status = worstStatus([...states.map((s) => s.status), ...(reported[o.organ.id] ? [reported[o.organ.id]!.level] : [])])
      return { organ, indicators: states, status }
    })
    const snap = buildTwinSnapshot({
      astronaut,
      env,
      indicators,
      organs,
      readiness: readinessScore(organs, Boolean(latestCheckIn)),
      checkedInToday: Boolean(latestCheckIn),
      symptoms,
    })
    return { snap, symptoms, latestCheckIn, env }
  }, [astronaut, readings, row.id, row.missionId])

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-6">
        <section aria-labelledby="systems-title" className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="systems-title" className="text-lg font-semibold">
              Body systems
            </h2>
            {summary && (
              <p className="text-xs text-muted-foreground">
                {summary.latestCheckIn ? `Check-in today ${when(summary.latestCheckIn.timestamp_utc)}` : 'No check-in today'} ·
                compared with the astronaut&apos;s own baseline · SYNTHETIC_DEMO
              </p>
            )}
          </div>
          {!summary ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading vitals…</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {[...summary.snap.organs]
                .sort((a, b) => ['act', 'watch', 'unknown', 'normal'].indexOf(a.status) - ['act', 'watch', 'unknown', 'normal'].indexOf(b.status))
                .map((card) => (
                  <li key={card.id} className="flex flex-wrap items-start gap-3 py-3">
                    <StatusPill status={card.status} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{card.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.lead.label}:{' '}
                        <span className="font-mono text-foreground">
                          {card.lead.value === null ? '—' : `${formatValue(card.lead.value, card.lead.decimals)} ${card.lead.unit}`}
                        </span>{' '}
                        · {card.lead.message}
                      </p>
                      {card.symptoms.length > 0 && (
                        <p className="text-sm text-status-act">Reported: {card.symptoms.join(', ').toLowerCase()}</p>
                      )}
                    </div>
                  </li>
                ))}
            </ul>
          )}
          {summary && summary.symptoms.length > 0 && (
            <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
              <span className="font-medium">Symptoms today:</span>{' '}
              {SYMPTOMS.filter((s) => summary.symptoms.includes(s.id))
                .map((s) => `${s.label}${s.level === 'act' ? ' (urgent)' : ''}`)
                .join(', ')}
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Crew Pulse answers are not shared with Earth. Thresholds are demo criteria, not clinical.
          </p>
        </section>

        <section aria-labelledby="reports-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="reports-title" className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="size-5 text-primary" aria-hidden />
            Medical Report Packets
          </h2>
          {!thread || thread.reports.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No report packets from {row.name.split(' ')[0]} yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {[...thread.reports].reverse().map((r) =>
                r.arrived && r.report ? (
                  <li key={r.id} className="rounded-xl border border-border">
                    <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                      Sent {when(r.createdAt)} · received {when(r.arrivesAt)}
                    </p>
                    <pre className="max-h-72 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{r.report.text}</pre>
                  </li>
                ) : (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm">
                    <Satellite className="size-5 shrink-0 animate-pulse text-primary motion-reduce:animate-none" aria-hidden />
                    Packet sent {when(r.createdAt)} is crossing space · arrives {arrivesIn(r.arrivesAt)}.
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-6">
        <AdviceComposer row={row} thread={thread} onSent={load} />
        <FitnessForm row={row} onSaved={onDecided} />
      </div>
    </div>
  )
}

function AdviceComposer({
  row,
  thread,
  onSent,
}: {
  row: GroundCrewRow
  thread: { delaySeconds: number; messages: GroundMessage[] } | null
  onSent: () => Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendAdvice(row.id, text.trim())
      setText('')
      await onSent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="advice-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="advice-title" className="text-lg font-semibold">
        Advice to {row.name.split(' ')[0]}
      </h2>
      <p className="text-xs text-muted-foreground">
        Arrives on board after the one-way delay ({formatDelay(row.delaySeconds)}). Advice only: onboard emergencies are
        handled on board first.
      </p>
      <form onSubmit={(e) => void send(e)} className="mt-3 flex flex-col gap-2">
        <label htmlFor="advice-text" className="sr-only">
          Message
        </label>
        <textarea
          id="advice-text"
          rows={4}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Re-measure resting heart rate tonight and tomorrow morning; no EVA until we review."
          className="w-full rounded-lg border border-input bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        {error && (
          <p role="alert" className="text-sm text-status-act">
            {error}
          </p>
        )}
        <Button type="submit" className="self-end" disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          Send to the ship
        </Button>
      </form>
      {thread && thread.messages.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          {[...thread.messages].reverse().map((m) => {
            const arrived = Date.parse(m.arrives_at) <= Date.now()
            return (
              <li key={m.id} className="rounded-lg bg-secondary/60 p-3 text-sm">
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sent {when(m.sent_at)} ·{' '}
                  {m.read_at ? `read ${when(m.read_at)}` : arrived ? 'delivered, not read yet' : `arrives ${arrivesIn(m.arrives_at)}`}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function FitnessForm({ row, onSaved }: { row: GroundCrewRow; onSaved: () => Promise<void> }) {
  const [status, setStatus] = useState<FitnessStatus>(row.fitness?.status ?? 'ready')
  const [restrictions, setRestrictions] = useState(row.fitness?.restrictions ?? '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      await decideFitness(row.id, status, restrictions, note)
      setNote('')
      setMessage('Saved. The astronaut and mission management are updated.')
      await onSaved()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="fitness-form-title" className="rounded-2xl border border-border bg-card p-5">
      <h2 id="fitness-form-title" className="text-lg font-semibold">
        Fitness for duty
      </h2>
      <form onSubmit={(e) => void save(e)} className="mt-3 flex flex-col gap-3">
        <fieldset>
          <legend className="sr-only">Status</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['ready', 'limited', 'not-ready'] as FitnessStatus[]).map((s) => {
              const st = FITNESS_STYLE[s]
              return (
                <label
                  key={s}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-3 text-center text-xs font-medium',
                    status === s ? st.tone : 'border-border text-muted-foreground hover:bg-secondary',
                  )}
                >
                  <input type="radio" name="fitness" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
                  <st.icon className="size-5" aria-hidden />
                  {FITNESS_LABEL[s]}
                </label>
              )
            })}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Restrictions <span className="text-xs font-normal text-muted-foreground">Shared with mission management. No medical details.</span>
          <input
            value={restrictions}
            maxLength={200}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder="e.g. No EVA until cleared"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Medical note{' '}
          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Private: you and the astronaut only
          </span>
          <textarea
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-lg border border-input bg-background p-3 text-sm font-normal focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        <Button type="submit" disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          Save decision
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </section>
  )
}
