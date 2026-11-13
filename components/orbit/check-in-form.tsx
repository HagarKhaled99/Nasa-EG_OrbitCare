'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Annoyed,
  Camera,
  CheckCircle2,
  Frown,
  Laugh,
  Meh,
  Minus,
  Plus,
  RefreshCw,
  Smile,
  Watch,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { READING_SOURCE, SENSOR_IDS, WATCH_SYNC, type ReadingSource } from '@/lib/orbit/sensors'
import { deviationStatus } from '@/lib/orbit/health'
import { INDICATORS, type MeasuredIndicatorId } from '@/lib/orbit/indicators'
import { HowWhyDialog } from './how-why-dialog'
import { useOrbit } from './orbit-provider'
import { StatusPill } from './status-pill'

const GROUPS: { title: string; hint: string; ids: MeasuredIndicatorId[] }[] = [
  {
    title: 'From your watch',
    hint: 'Measured automatically overnight and at wake-up. Tap − or + if a reading looks wrong.',
    ids: ['heartRate', 'systolic', 'diastolic', 'temperature', 'sleep', 'exercise'],
  },
  {
    title: 'Glucose patch and quick tests',
    hint: 'Blood sugar comes from your patch. Grip strength and near vision are 1-minute tests you do yourself.',
    ids: ['glucose', 'grip', 'vision'],
  },
]

const SOURCE_TAG: Record<ReadingSource, { label: string; className: string }> = {
  watch: { label: 'Watch', className: 'bg-primary/10 text-primary' },
  patch: { label: 'Patch', className: 'bg-primary/10 text-primary' },
  you: { label: 'You', className: 'bg-muted text-muted-foreground' },
}

const MOODS = [
  { value: 1, label: 'Very low', icon: Frown },
  { value: 2, label: 'Low', icon: Annoyed },
  { value: 3, label: 'Okay', icon: Meh },
  { value: 4, label: 'Good', icon: Smile },
  { value: 5, label: 'Great', icon: Laugh },
]

const TOTAL_FIELDS = GROUPS.reduce((n, g) => n + g.ids.length, 0) + 1

export function CheckInForm() {
  const { astronaut, indicators, submitCheckIn, checkedInToday, organs } = useOrbit()
  const sensorValues = () => {
    const next: Partial<Record<MeasuredIndicatorId, string>> = {}
    for (const id of SENSOR_IDS) next[id] = indicators[id].value.toFixed(INDICATORS[id].decimals)
    return next
  }
  const [values, setValues] = useState<Partial<Record<MeasuredIndicatorId, string>>>(sensorValues)
  const [photo, setPhoto] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [syncedJustNow, setSyncedJustNow] = useState(false)

  const filled = Object.values(values).filter((v) => v !== undefined && v !== '').length
  const progress = Math.round((filled / TOTAL_FIELDS) * 100)

  const setValue = (id: MeasuredIndicatorId, value: string) =>
    setValues((prev) => ({ ...prev, [id]: value }))

  const step = (id: MeasuredIndicatorId, direction: 1 | -1) => {
    const meta = INDICATORS[id]
    const current = Number(values[id] ?? astronaut.baseline[id])
    const next = Math.max(0, current + direction * meta.step)
    setValue(id, next.toFixed(meta.decimals))
  }

  const syncAgain = () => {
    setValues((prev) => ({ ...prev, ...sensorValues() }))
    setSyncedJustNow(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed: Partial<Record<MeasuredIndicatorId, number>> = {}
    for (const [id, raw] of Object.entries(values)) {
      if (raw === undefined || raw === '') continue
      const n = Number(raw)
      if (Number.isFinite(n) && n >= 0) parsed[id as MeasuredIndicatorId] = n
    }
    submitCheckIn(parsed)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <section
        aria-live="polite"
        className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border border-status-ok/40 bg-card p-8 text-center"
      >
        <CheckCircle2 className="size-12 text-status-ok" aria-hidden />
        <h2 className="text-2xl font-semibold">Check-in logged</h2>
        <p className="text-muted-foreground">
          Your twin has been updated. Here is how your body systems look now.
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
          <Button size="lg" className="h-11 px-4" nativeButton={false} render={<Link href="/" />}>
            See my twin
          </Button>
          <Button size="lg" variant="outline" className="h-11 px-4" nativeButton={false} render={<Link href="/crew" />}>
            Answer Crew Pulse
          </Button>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-4 rounded-2xl border border-primary/40 bg-card p-5 md:flex-row md:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Watch className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
              Synced from your ORBIT watch and glucose patch
              <span className="inline-flex items-center gap-1 text-xs font-medium text-status-ok">
                <span className="size-2 rounded-full bg-status-ok" aria-hidden />
                Connected
              </span>
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground" aria-live="polite">
              {syncedJustNow ? 'Synced just now' : `Last sync ${WATCH_SYNC.lastSync}`} · battery {WATCH_SYNC.battery}% ·
              about 30 seconds left
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
        <Button type="button" variant="outline" size="lg" className="h-11 px-4" onClick={syncAgain}>
          <RefreshCw aria-hidden />
          Sync again
        </Button>
      </div>

      {checkedInToday && (
        <p className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
          You already checked in today. Submitting again will update today&apos;s values.
        </p>
      )}

      {GROUPS.map((group) => (
        <fieldset key={group.title} className="rounded-2xl border border-border bg-card p-5">
          <legend className="sr-only">{group.title}</legend>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.hint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.ids.map((id) => (
              <NumberField
                key={id}
                id={id}
                value={values[id] ?? ''}
                baseline={astronaut.baseline[id]}
                onChange={(v) => setValue(id, v)}
                onStep={(d) => step(id, d)}
              />
            ))}
          </div>
        </fieldset>
      ))}

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
          Rash, swelling, eye redness or a wound. The photo is attached to your next medical report.
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
              <Image src={photo} alt="Symptom photo preview" fill className="object-cover" unoptimized />
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
        <p className="text-sm text-muted-foreground">You can skip any field you cannot measure today.</p>
        <Button type="submit" size="lg" className="h-12 px-6 text-base" disabled={filled === 0}>
          Save check-in
        </Button>
      </div>
    </form>
  )
}

function NumberField({
  id,
  value,
  baseline,
  onChange,
  onStep,
}: {
  id: MeasuredIndicatorId
  value: string
  baseline: number
  onChange: (v: string) => void
  onStep: (direction: 1 | -1) => void
}) {
  const meta = INDICATORS[id]
  const inputId = `field-${id}`
  const hasValue = value !== '' && Number.isFinite(Number(value))
  const live = hasValue ? deviationStatus(Number(value), baseline, meta).status : null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {meta.label}
        </label>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase',
              SOURCE_TAG[READING_SOURCE[id]].className,
            )}
          >
            {SOURCE_TAG[READING_SOURCE[id]].label}
          </span>
          {live && <StatusPill status={live} />}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onStep(-1)}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-background hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Decrease ${meta.label}`}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <div className="relative flex-1">
          <input
            id={inputId}
            type="number"
            inputMode="decimal"
            step={meta.step}
            min={0}
            value={value}
            placeholder={baseline.toFixed(meta.decimals)}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 pr-14 font-mono text-lg font-semibold placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {meta.unit}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onStep(1)}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-input bg-background hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={`Increase ${meta.label}`}
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Your normal: <span className="font-mono">{baseline.toFixed(meta.decimals)}</span>
        </span>
        <HowWhyDialog id={id} />
      </div>
    </div>
  )
}
