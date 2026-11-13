'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  Bluetooth,
  Check,
  Droplet,
  Gauge,
  HeartPulse,
  Info,
  Moon,
  Thermometer,
  Watch,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Astronaut } from '@/lib/orbit/crew'
import { SENSOR_READINGS } from '@/lib/orbit/sensors'
import { AuthSplit } from './auth-split'

const STEPS = ['About you', 'Pair your watch', 'Record your normal']
const ROLES = ['Commander', 'Flight Engineer', 'Mission Specialist', 'Crew Medical Officer']
const MISSIONS = ['ARES-IV · Mars transit', 'Artemis · Lunar base', 'ISS expedition']

const READING_ICONS: Record<(typeof SENSOR_READINGS)[number]['key'], LucideIcon> = {
  hr: HeartPulse,
  bp: Gauge,
  spo2: Wind,
  temp: Thermometer,
  sleep: Moon,
  exercise: Activity,
  glucose: Droplet,
}

const DEVICES = [
  { id: 'watch', name: 'ORBIT watch', serial: 'OW-2231', where: 'Wrist, worn day and night', icon: Watch },
  { id: 'patch', name: 'Glucose patch', serial: 'GP-118', where: 'Upper arm, replaced every 14 days', icon: Droplet },
] as const

const inputClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

export function SignUp() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({
    name: '',
    role: ROLES[2],
    dob: '',
    mission: MISSIONS[0],
    pin: '',
  })
  const [figure, setFigure] = useState<Astronaut['figure']>('female')
  const [paired, setPaired] = useState<Record<string, boolean>>({})
  const [showErrors, setShowErrors] = useState(false)

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const nameError = form.name.trim().length < 2
  const pinError = !/^\d{4}$/.test(form.pin)

  const submitAboutYou = (e: React.FormEvent) => {
    e.preventDefault()
    if (nameError || pinError) {
      setShowErrors(true)
      return
    }
    setStep(1)
  }

  return (
    <AuthSplit figure={figure}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {step === 0 ? (
            <Link
              href="/login"
              className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to sign in
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </button>
          )}
          <StepIndicator current={step} />
        </div>

        {step === 0 && (
          <form onSubmit={submitAboutYou} noValidate className="flex flex-col gap-5">
            <Heading title="Create your crew profile" description="Done once before launch, together with your crew medical officer." />

            <Field label="Full name" htmlFor="su-name" error={showErrors && nameError ? 'Enter your full name.' : undefined}>
              <input
                id="su-name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className={inputClass}
                aria-invalid={showErrors && nameError}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Crew role" htmlFor="su-role">
                <select id="su-role" value={form.role} onChange={(e) => update('role', e.target.value)} className={inputClass}>
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <Field label="Date of birth" htmlFor="su-dob">
                <input
                  id="su-dob"
                  type="date"
                  autoComplete="bday"
                  value={form.dob}
                  onChange={(e) => update('dob', e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Mission" htmlFor="su-mission">
              <select id="su-mission" value={form.mission} onChange={(e) => update('mission', e.target.value)} className={inputClass}>
                {MISSIONS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Body for your twin</legend>
              <div role="radiogroup" aria-label="Body for your twin" className="grid grid-cols-2 gap-3">
                {(['female', 'male'] as const).map((option) => {
                  const checked = figure === option
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => setFigure(option)}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        checked && 'border-primary bg-primary/10',
                      )}
                    >
                      <span className="relative h-16 w-9 shrink-0">
                        <Image
                          src={`/images/body-twin-${option}.png`}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-contain [mask-image:radial-gradient(ellipse_50%_56%_at_center,black_72%,transparent_100%)]"
                        />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium">{option === 'female' ? 'Female body' : 'Male body'}</span>
                        <span className="text-xs text-muted-foreground">Twin figure and reference ranges</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <Field
              label="Choose a 4-digit PIN"
              htmlFor="su-pin"
              error={showErrors && pinError ? 'Use exactly 4 digits.' : undefined}
            >
              <input
                id="su-pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={4}
                value={form.pin}
                onChange={(e) => update('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={cn(inputClass, 'max-w-40 font-mono tracking-[0.5em]')}
                aria-invalid={showErrors && pinError}
              />
            </Field>

            <div className="flex flex-col gap-2">
              <Button type="submit" size="lg" className="h-12 text-base">
                Continue to watch pairing
              </Button>
              <p className="text-center text-xs text-muted-foreground">Stored on board only. Your CMO can edit it.</p>
            </div>
          </form>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-5">
            <Heading
              title="Your watch does the measuring"
              description="Your ORBIT watch and glucose patch send readings to your twin automatically. Your daily check-in becomes a quick review plus the questions only you can answer."
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {DEVICES.map((device) => {
                const isPaired = paired[device.id]
                return (
                  <li key={device.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <device.icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <p className="font-medium">
                          {device.name} · <span className="font-mono text-sm">{device.serial}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{device.where}</p>
                      </div>
                    </div>
                    {isPaired ? (
                      <span
                        role="status"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-status-ok/40 bg-status-ok/10 text-sm font-medium text-status-ok"
                      >
                        <Check className="size-4" aria-hidden />
                        Paired
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() => setPaired((p) => ({ ...p, [device.id]: true }))}
                      >
                        <Bluetooth aria-hidden />
                        Pair
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">What it reads for you</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {SENSOR_READINGS.map((r) => {
                  const Icon = READING_ICONS[r.key]
                  return (
                    <li key={r.key} className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-muted-foreground"> · {r.note}</span>
                      </div>
                      <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
                        {r.device}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
                Still logged by you: grip strength, near vision, mood and Crew Pulse. If a sensor fails, every reading
                can be typed in by hand.
              </p>
            </div>

            <Button type="button" size="lg" className="h-12 text-base" onClick={() => setStep(2)}>
              Continue
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <Heading
              title="30 days to learn your normal"
              description="Wear your watch from L-30 to L-1. Your twin averages these days into your personal baseline, and every reading in flight is compared with it — not with textbook ranges."
            />
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Normal', text: 'Under 10% from your normal', tone: 'border-status-ok/40 bg-status-ok/10 text-status-ok' },
                { label: 'Watch', text: '10–20% from your normal', tone: 'border-status-watch/40 bg-status-watch/10 text-status-watch' },
                { label: 'Act', text: 'Over 20% or a medical limit', tone: 'border-status-act/40 bg-status-act/10 text-status-act' },
              ].map((s) => (
                <li key={s.label} className={cn('rounded-2xl border p-4', s.tone)}>
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="size-2 rounded-full bg-current" aria-hidden />
                    {s.label}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{s.text}</p>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-relaxed">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Recording starts as soon as you finish. You can sign in and use your twin today.
            </p>
            <Button type="button" size="lg" className="h-12 text-base" onClick={() => router.push('/login')}>
              Finish and sign in
            </Button>
          </section>
        )}
      </div>
    </AuthSplit>
  )
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Sign-up progress">
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold',
                done && 'border-status-ok bg-status-ok text-background',
                active && 'border-primary bg-primary text-primary-foreground',
                !done && !active && 'border-border bg-card text-muted-foreground',
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn('hidden text-sm sm:inline', active ? 'font-medium' : 'text-muted-foreground')}>
              {label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold text-balance">{title}</h1>
      <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">{description}</p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-sm text-status-act" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
