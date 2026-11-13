/**
 * Daily check-in form (Member 4, Shahd). Ported from the MEMBER4 branch (Next.js) into the Vite app.
 *
 * Shahd's design: sensor readings arrive automatically and are read-only; only measurements the astronaut
 * takes themselves are typed in. Linked to the crew database:
 *  - Watch values (heart rate, SpO₂, sleep, exercise) are today's values from the database/twin. A missing
 *    reading shows UNKNOWN ("no signal, measure again"), never the person's normal value (plan §12).
 *  - Blood pressure (cuff), temperature (thermometer) and glucose (meter) are typed in. The watch does not
 *    measure them (plan §3).
 *  - Saving calls submitCheckIn(): the twin updates at once and a MANUAL_CHECKIN row is stored in the database.
 *  - Live watch feed (mock adapter, every 5 s) with time and signal quality. Watch values can never be edited.
 *  - Symptoms checklist: urgent symptoms raise Act even when the numbers look normal (plan §7).
 *  - Radiation comes from the separate personal dosimeter (read-only), not from the watch.
 */
import { useState } from 'react'
import {
  Annoyed,
  Camera,
  CheckCircle2,
  CircleHelp,
  Frown,
  Laugh,
  Loader2,
  Lock,
  Meh,
  Pause,
  Play,
  Radiation,
  Siren,
  Smile,
  Watch,
  X,
} from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { READING_SOURCE, WATCH_SYNC, type ReadingSource } from '@/lib/orbit/sensors'
import { deviationStatus, type Status } from '@/lib/orbit/health'
import { INDICATORS, RADIATION_CAREER_LIMIT, type MeasuredIndicatorId } from '@/lib/orbit/indicators'
import { WATCH_POLL_MS, type SampleQuality } from '@/lib/orbit/sensor-adapter'
import { SYMPTOMS, type SymptomId } from '@/lib/orbit/symptoms'
import { HowWhyDialog } from './how-why-dialog'
import { useOrbit } from './orbit-provider'
import { StatusPill } from './status-pill'

/** Streamed every 5 s by the watch. */
const LIVE_IDS = ['heartRate', 'spo2'] as const
/** Summarised once a day by the watch. */
const DAILY_IDS: MeasuredIndicatorId[] = ['sleep', 'exercise']

const QUALITY_TEXT: Record<SampleQuality, { label: string; className: string }> = {
  good: { label: 'Good signal', className: 'text-status-ok' },
  motion: { label: 'Wrist moving · reading not used', className: 'text-status-watch' },
  'no-signal': { label: 'No signal', className: 'text-muted-foreground' },
}

function secondsAgo(at: number | undefined) {
  if (!at) return null
  const s = Math.max(0, Math.round((Date.now() - at) / 1000))
  return s < 2 ? 'just now' : `${s} s ago`
}

const MANUAL_GROUPS: { title: string; hint: string; ids: MeasuredIndicatorId[] }[] = [
  {
    title: 'Measured by you',
    hint: 'Blood pressure from the arm cuff, temperature from the thermometer, blood sugar from the fingerstick meter. The watch cannot measure these.',
    ids: ['systolic', 'diastolic', 'temperature', 'glucose'],
  },
  {
    title: 'Quick self-tests',
    hint: 'Grip strength and near vision are 1-minute tests you do yourself.',
    ids: ['grip', 'vision'],
  },
]

const SOURCE_TAG: Record<ReadingSource, { label: string; className: string }> = {
  watch: { label: 'Watch', className: 'bg-primary/10 text-primary' },
  cuff: { label: 'Cuff', className: 'bg-muted text-muted-foreground' },
  thermometer: { label: 'Thermometer', className: 'bg-muted text-muted-foreground' },
  meter: { label: 'Meter', className: 'bg-muted text-muted-foreground' },
  you: { label: 'You', className: 'bg-muted text-muted-foreground' },
}

/** Physically possible values (typo / sensor-error check). These are NOT medical limits. */
const INPUT_LIMITS: Partial<Record<MeasuredIndicatorId, [number, number]>> = {
  systolic: [60, 250],
  diastolic: [30, 150],
  temperature: [32, 43],
  glucose: [20, 600],
  grip: [1, 120],
  vision: [0, 10],
}

const MOODS = [
  { value: 1, label: 'Very low', icon: Frown },
  { value: 2, label: 'Low', icon: Annoyed },
  { value: 3, label: 'Okay', icon: Meh },
  { value: 4, label: 'Good', icon: Smile },
  { value: 5, label: 'Great', icon: Laugh },
]

const MANUAL_IDS = MANUAL_GROUPS.flatMap((g) => g.ids)
const TOTAL_FIELDS = MANUAL_IDS.length + 1 // + mood

function checkValue(id: MeasuredIndicatorId, raw: string): { value?: number; error?: string } {
  if (raw.trim() === '') return {}
  const value = Number(raw.replace(',', '.'))
  if (!Number.isFinite(value)) return { error: 'Enter a number.' }
  const limits = INPUT_LIMITS[id]
  if (limits && (value < limits[0] || value > limits[1])) {
    return { error: `Check the reading: must be ${limits[0]}–${limits[1]} ${INDICATORS[id].unit}.` }
  }
  return { value }
}

export function CheckInForm() {
  const { astronaut, indicators, readings, readingsStatus, submitCheckIn, checkedInToday, organs, watch, symptomsToday } =
    useOrbit()
  const [symptoms, setSymptoms] = useState<SymptomId[]>(symptomsToday)
  const urgentChosen = SYMPTOMS.filter((x) => x.level === 'act' && symptoms.includes(x.id))
  const toggleSymptom = (id: SymptomId) =>
    setSymptoms((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const lastPacket = watch.samples[watch.samples.length - 1]
  const todayDose = [...readings]
    .reverse()
    .find((r) => r.mission_day === MISSION_DAY && r.radiation_dose_msv_daily !== null)?.radiation_dose_msv_daily
  const [values, setValues] = useState<Partial<Record<MeasuredIndicatorId, string>>>({})
  const [photo, setPhoto] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedTo, setSavedTo] = useState<'database' | 'tablet-only' | null>(null)

  const checks = Object.fromEntries(MANUAL_IDS.map((id) => [id, checkValue(id, values[id] ?? '')])) as Record<
    MeasuredIndicatorId,
    { value?: number; error?: string }
  >
  const sys = checks.systolic.value
  const dia = checks.diastolic.value
  const bpError = sys !== undefined && dia !== undefined && sys - dia < 15 ? 'The top number should be clearly above the bottom one. Measure again.' : null
  const hasErrors = MANUAL_IDS.some((id) => checks[id].error) || Boolean(bpError)
  const filled = MANUAL_IDS.filter((id) => checks[id].value !== undefined).length + (values.mood ? 1 : 0)
  const progress = Math.round((filled / TOTAL_FIELDS) * 100)


  const setValue = (id: MeasuredIndicatorId, value: string) => setValues((prev) => ({ ...prev, [id]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasErrors) {
      setShowErrors(true)
      return
    }
    const parsed: Partial<Record<MeasuredIndicatorId, number>> = {}
    for (const id of MANUAL_IDS) if (checks[id].value !== undefined) parsed[id] = checks[id].value
    if (values.mood) parsed.mood = Number(values.mood)
    setSaving(true)
    const where = await submitCheckIn(parsed, { symptoms })
    setSaving(false)
    setSavedTo(where)
  }

  if (savedTo) {
    return (
      <section
        aria-live="polite"
        className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-status-ok/40 bg-card p-8 text-center"
      >
        <CheckCircle2 className="size-12 text-status-ok" aria-hidden />
        <h2 className="text-2xl font-semibold">Check-in logged</h2>
        {urgentChosen.length > 0 && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-status-act/40 bg-status-act/10 px-3 py-2 text-sm font-medium">
            <Siren className="size-4 text-status-act" aria-hidden />
            Urgent symptom reported. Tell the crew medical officer now.
          </p>
        )}
        <p className="text-muted-foreground">
          {savedTo === 'database'
            ? 'Saved to the crew database. Your twin has been updated.'
            : 'Your twin has been updated on this tablet. The crew database was not reachable, so it was not stored there yet.'}
        </p>
        <ul className="flex flex-wrap justify-center gap-2">
          {organs.map((o) => (
            <li key={o.organ.id} className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm">
              {o.organ.shortName}
              <StatusPill status={o.status} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink to="/" className="h-11 px-4">
            See my twin
          </ButtonLink>
          <ButtonLink to="/crew" variant="outline" className="h-11 px-4">
            Answer Crew Pulse
          </ButtonLink>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-card p-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Watch className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
              Live from your ORBIT watch
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  watch.paused ? 'text-muted-foreground' : watch.stale ? 'text-status-watch' : 'text-status-ok',
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    watch.paused ? 'bg-muted-foreground' : watch.stale ? 'bg-status-watch' : 'bg-status-ok animate-pulse',
                  )}
                  aria-hidden
                />
                {watch.paused ? 'Paused' : watch.stale ? 'Stale: no good reading for 30 s' : `Streaming every ${WATCH_POLL_MS / 1000} s`}
              </span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Last packet {secondsAgo(lastPacket?.at) ?? '—'} · battery {WATCH_SYNC.battery}% · mission day {MISSION_DAY} ·{' '}
              {readingsStatus === 'database' ? 'history from the crew database' : 'simulated history'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Check-in progress"
              >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {filled}/{TOTAL_FIELDS}
              </span>
            </div>
          </div>
        </div>
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => watch.setPaused(!watch.paused)}>
          {watch.paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {watch.paused ? 'Resume stream' : 'Pause stream'}
        </Button>
      </div>

      {checkedInToday && (
        <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
          You already checked in today. Submitting again adds a new reading for today.
        </p>
      )}

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="sr-only">From your watch</legend>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">From your watch</h2>
            <p className="text-sm text-muted-foreground">
              Measured automatically. Nothing to type: sensor readings cannot be edited. If a reading is unreliable,
              hold your wrist still and the watch measures again.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Read-only
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LIVE_IDS.map((id) => {
            const state = indicators[id]
            const known = state && Number.isFinite(state.value)
            const quality = lastPacket ? (id === 'heartRate' ? lastPacket.heartRateQuality : lastPacket.spo2Quality) : null
            const rawLast = lastPacket ? (id === 'heartRate' ? lastPacket.heartRate : lastPacket.spo2) : null
            const goodAt = watch.good[id]?.at
            return (
              <FieldCard key={id} id={id} baseline={astronaut.baseline[id]} status={known ? state.status : 'unknown'}>
                <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3" aria-live="polite">
                  {known ? (
                    <span className="font-mono text-2xl font-semibold">{state.value.toFixed(INDICATORS[id].decimals)}</span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">No signal</span>
                  )}
                  <span className="text-sm text-muted-foreground">{INDICATORS[id].unit}</span>
                </div>
                {quality ? (
                  <p className={cn('text-xs', QUALITY_TEXT[quality].className)}>
                    {QUALITY_TEXT[quality].label}
                    {quality === 'motion' && rawLast !== null && ` (${rawLast} ${INDICATORS[id].unit})`}
                    {goodAt && ` · last good ${secondsAgo(goodAt)}`}
                    {watch.average[id]
                      ? ` · twin uses the 1-min average of ${watch.average[id]!.packets} good packets`
                      : ' · averaging the first minute'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Waiting for the first packet…</p>
                )}
                {!known && (
                  <p className="text-xs text-muted-foreground">Unknown, not normal. Keep your wrist still for a minute.</p>
                )}
              </FieldCard>
            )
          })}
          {DAILY_IDS.map((id) => {
            const state = indicators[id]
            const known = state && Number.isFinite(state.value)
            return (
              <FieldCard key={id} id={id} baseline={astronaut.baseline[id]} status={known ? state.status : 'unknown'}>
                <div className="flex items-center justify-between rounded-lg border border-input bg-background px-4 py-3">
                  {known ? (
                    <span className="font-mono text-2xl font-semibold">{state.value.toFixed(INDICATORS[id].decimals)}</span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">No reading yet</span>
                  )}
                  <span className="text-sm text-muted-foreground">{INDICATORS[id].unit}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {id === 'sleep' ? 'Last night, estimated from wrist movement' : 'Today, from the exercise devices'}
                </p>
              </FieldCard>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Simulated watch (demo data). SpO₂ is a proposed sensor design, not a validated spaceflight instrument.
        </p>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="sr-only">Personal dosimeter</legend>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Radiation className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Radiation · personal dosimeter</h2>
            <p className="text-sm text-muted-foreground">
              A separate radiation sensor worn on your chest. The watch cannot measure radiation. Read-only.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Today</dt>
            <dd className="font-mono font-semibold">
              {todayDose != null ? `${todayDose.toFixed(2)} mSv` : <span className="text-muted-foreground">Unknown</span>}
            </dd>
            <dt className="text-muted-foreground">Mission total</dt>
            <dd className="font-mono font-semibold">
              {Math.round(indicators.radiationDose.value)} mSv{' '}
              <span className="font-normal text-muted-foreground">
                ({Math.round((indicators.radiationDose.value / RADIATION_CAREER_LIMIT) * 100)}% of {RADIATION_CAREER_LIMIT})
              </span>
            </dd>
          </dl>
        </div>
      </fieldset>

      {MANUAL_GROUPS.map((group) => (
        <fieldset key={group.title} className="rounded-2xl border border-border bg-card p-5">
          <legend className="sr-only">{group.title}</legend>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.hint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.ids.map((id) => {
              const meta = INDICATORS[id]
              const check = checks[id]
              const baseline = astronaut.baseline[id]
              const error = check.error ?? (id === 'diastolic' ? bpError : null)
              const status: Status | null =
                check.value !== undefined ? deviationStatus(check.value, baseline, meta).status : null
              const inputId = `checkin-${id}`
              return (
                <FieldCard key={id} id={id} baseline={baseline} status={status} labelFor={inputId}>
                  <div className="flex items-center gap-3 rounded-lg border border-input bg-background px-4 py-3 focus-within:ring-2 focus-within:ring-ring">
                    <input
                      id={inputId}
                      inputMode="decimal"
                      value={values[id] ?? ''}
                      onChange={(e) => setValue(id, e.target.value)}
                      placeholder="Enter reading"
                      aria-invalid={showErrors && Boolean(error)}
                      className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold outline-none placeholder:text-base placeholder:font-normal placeholder:text-muted-foreground/60"
                    />
                    <span className="text-sm text-muted-foreground">{meta.unit}</span>
                  </div>
                  {error && (showErrors || check.error) ? (
                    <p className="text-xs text-status-act" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {check.value === undefined ? 'Skip it if you cannot measure today.' : 'Entered by you'}
                    </p>
                  )}
                </FieldCard>
              )
            })}
          </div>
        </fieldset>
      ))}

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="sr-only">Symptoms</legend>
        <h2 className="text-lg font-semibold">Any symptoms today?</h2>
        <p className="text-sm text-muted-foreground">
          Tick everything you notice. Urgent symptoms raise an alert even when your numbers look normal.
        </p>
        {(['act', 'watch'] as const).map((level) => (
          <div key={level} className="mt-4">
            <p
              className={cn(
                'mb-2 font-mono text-[11px] font-semibold tracking-[0.14em] uppercase',
                level === 'act' ? 'text-status-act' : 'text-muted-foreground',
              )}
            >
              {level === 'act' ? 'Urgent' : 'Other'}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {SYMPTOMS.filter((x) => x.level === level).map((x) => {
                const checked = symptoms.includes(x.id)
                return (
                  <label
                    key={x.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border bg-secondary/40 p-3 text-sm transition-colors hover:bg-secondary focus-within:ring-2 focus-within:ring-ring',
                      checked ? (level === 'act' ? 'border-status-act bg-status-act/10' : 'border-primary bg-primary/10') : 'border-border',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSymptom(x.id)}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="font-medium">{x.label}</span>
                      <span className="block text-xs text-muted-foreground">{x.why}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        {urgentChosen.length > 0 && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-status-act/40 bg-status-act/10 p-3 text-sm">
            <Siren className="mt-0.5 size-4 shrink-0 text-status-act" aria-hidden />
            <span>
              <span className="font-semibold">Tell the crew medical officer now.</span> Your twin will raise an Act alert
              for {urgentChosen.map((x) => x.label.toLowerCase()).join(', ')}, even if your readings look normal. Demo
              criteria, to be reviewed by a flight surgeon.
            </span>
          </p>
        )}
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="sr-only">Mood</legend>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">How do you feel right now?</h2>
            <p className="text-sm text-muted-foreground">Private. Only you and the crew medical officer see this.</p>
          </div>
          <HowWhyDialog id="mood" label="Why we ask" />
        </div>
        <div role="radiogroup" aria-label="Mood" className="grid grid-cols-5 gap-2">
          {MOODS.map((mood) => {
            const selected = values.mood === String(mood.value)
            return (
              <button
                key={mood.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setValue('mood', String(mood.value))}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/60 px-2 py-4 text-sm font-medium transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  selected && 'border-primary bg-primary/15 text-primary',
                )}
              >
                <mood.icon className="size-7" aria-hidden />
                <span className="font-mono text-xs">{mood.value}</span>
                <span className="text-xs">{mood.label}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-border bg-card p-5">
        <legend className="sr-only">Optional photo</legend>
        <h2 className="text-lg font-semibold">Visible symptom? (optional)</h2>
        <p className="text-sm text-muted-foreground">
          Rash, swelling, eye redness or a wound. The photo stays on this tablet for your next medical report.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-input bg-secondary px-4 text-sm font-medium hover:bg-accent focus-within:ring-2 focus-within:ring-ring">
            <Camera className="size-4" aria-hidden />
            {photo ? 'Retake photo' : 'Take photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) setPhoto(URL.createObjectURL(file))
              }}
            />
          </label>
          {photo && (
            <div className="relative size-20 overflow-hidden rounded-lg border border-border">
              <img src={photo} alt="Symptom photo preview" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="absolute top-1 right-1 rounded-full bg-background/80 p-1"
                aria-label="Remove photo"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {showErrors && hasErrors ? (
          <p className="text-sm text-status-act" role="alert">
            Fix the readings marked in red.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">You can skip any field you cannot measure today.</p>
        )}
        <Button type="submit" className="h-12 px-6 text-base" disabled={(filled === 0 && symptoms.length === 0) || saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {saving ? 'Saving…' : 'Save check-in'}
        </Button>
      </div>
    </form>
  )
}

function FieldCard({
  id,
  baseline,
  status,
  labelFor,
  children,
}: {
  id: MeasuredIndicatorId
  baseline: number
  status: Status | 'unknown' | null
  labelFor?: string
  children: React.ReactNode
}) {
  const meta = INDICATORS[id]
  const source = READING_SOURCE[id]
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-2">
        {labelFor ? (
          <label htmlFor={labelFor} className="text-sm font-medium">
            {meta.label}
          </label>
        ) : (
          <span className="text-sm font-medium">{meta.label}</span>
        )}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase',
              SOURCE_TAG[source].className,
            )}
          >
            {SOURCE_TAG[source].label}
          </span>
          {status === 'unknown' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <CircleHelp className="size-3" aria-hidden />
              Unknown
            </span>
          ) : (
            status && <StatusPill status={status} />
          )}
        </div>
      </div>
      {children}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Your normal: <span className="font-mono">{baseline.toFixed(meta.decimals)}</span>
        </span>
        <HowWhyDialog id={id} />
      </div>
    </div>
  )
}
