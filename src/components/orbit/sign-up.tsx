import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  Bluetooth,
  Check,
  ChevronDown,
  Download,
  Gauge,
  HeartPulse,
  Info,
  Loader2,
  Moon,
  Radiation,
  Smile,
  Thermometer,
  TriangleAlert,
  Watch,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Astronaut } from '@/lib/orbit/crew'
import type { MeasuredIndicatorId } from '@/lib/orbit/indicators'
import { SENSOR_READINGS } from '@/lib/orbit/sensors'
import {
  BASELINE_FIELDS,
  PREFLIGHT_DAYS,
  checkBaselineValue,
  checkPulsePressure,
  defaultBaseline,
  simulatePreflightWatch,
  type BaselineField,
  type BaselineSource,
  type FieldCheck,
  type PreflightStat,
} from '@/lib/orbit/baseline'
import { isValidPinFormat, PIN_LENGTH } from '@/lib/orbit/auth/auth-service'
import { CREW_ROLES, MISSIONS, nameTaken, type MissionId } from '@/lib/orbit/profiles'
import { getEnvironment, formatDelay } from '@/lib/orbit/environments'
import { ApiError } from '@/lib/orbit/api/crew-api'
import { AuthSplit, AuthTabs } from './auth-split'
import { useOrbit } from './orbit-provider'

const STEPS = ['About you', 'Pair devices', 'Your baseline']

const READING_ICONS: Record<(typeof SENSOR_READINGS)[number]['key'], LucideIcon> = {
  hr: HeartPulse,
  spo2: Wind,
  sleep: Moon,
  activity: Activity,
  bp: Gauge,
  temp: Thermometer,
  radiation: Radiation,
  self: Smile,
}

type DeviceId = 'watch' | 'dosimeter'
type PairState = 'idle' | 'searching' | 'paired'

const DEVICES: Array<{ id: DeviceId; name: string; serial: string; where: string; icon: LucideIcon; required: boolean }> = [
  {
    id: 'watch',
    name: 'ORBIT watch',
    serial: 'OW-2231',
    where: 'Wrist, day and night. Heart rate, SpO₂, sleep and activity.',
    icon: Watch,
    required: false,
  },
  {
    id: 'dosimeter',
    name: 'Personal dosimeter',
    serial: 'PD-0417',
    where: 'Chest pocket. Separate radiation sensor, not part of the watch.',
    icon: Radiation,
    required: false,
  },
]

const inputClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[invalid=true]:border-status-act'

function ageFrom(dob: string, today = new Date()) {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

export function SignUp() {
  const navigate = useNavigate()
  const { profiles, createCrewProfile } = useOrbit()
  const [step, setStep] = useState(0)

  // ----- step 1: about you -----
  const [about, setAbout] = useState({
    name: '',
    role: CREW_ROLES[2] as string,
    dob: '',
    missionId: MISSIONS[0].id as MissionId,
    pin: '',
    pinConfirm: '',
  })
  const [figure, setFigure] = useState<Astronaut['figure']>('female')
  const [showAboutErrors, setShowAboutErrors] = useState(false)
  const update = (key: keyof typeof about, value: string) => setAbout((c) => ({ ...c, [key]: value }))

  const age = ageFrom(about.dob)
  const aboutErrors = {
    name:
      about.name.trim().length < 2
        ? 'Enter your full name.'
        : nameTaken(about.name, profiles)
          ? 'A profile with this name already exists on this tablet.'
          : null,
    dob: !about.dob
      ? 'Enter your date of birth.'
      : age === null || age < 18 || age > 80
        ? 'Check the date. Crew members must be between 18 and 80.'
        : null,
    pin: !isValidPinFormat(about.pin)
      ? `Use exactly ${PIN_LENGTH} digits.`
      : /^(\d)\1+$/.test(about.pin) || '0123456789'.includes(about.pin) || '9876543210'.includes(about.pin)
        ? 'Too easy to guess. Avoid repeated or sequential digits.'
        : null,
    pinConfirm: about.pinConfirm !== about.pin ? 'The two PINs do not match.' : null,
  }
  const aboutValid = Object.values(aboutErrors).every((e) => e === null)

  // ----- step 2: devices -----
  const [pairing, setPairing] = useState<Record<DeviceId, PairState>>({ watch: 'idle', dosimeter: 'idle' })
  const pair = (id: DeviceId) => {
    setPairing((c) => ({ ...c, [id]: 'searching' }))
    window.setTimeout(() => setPairing((c) => ({ ...c, [id]: 'paired' })), 1500)
  }
  const watchPaired = pairing.watch === 'paired'

  // ----- step 3: baseline -----
  const [values, setValues] = useState<Partial<Record<MeasuredIndicatorId, string>>>({})
  const [sources, setSources] = useState<Partial<Record<MeasuredIndicatorId, BaselineSource>>>({})
  const [preflight, setPreflight] = useState<Record<string, PreflightStat> | null>(null)
  const [showOptional, setShowOptional] = useState(false)
  const [showBaselineErrors, setShowBaselineErrors] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const setValue = (id: MeasuredIndicatorId, raw: string) => {
    setValues((c) => ({ ...c, [id]: raw }))
    setSources((c) => ({ ...c, [id]: 'manual' }))
  }

  const importFromWatch = () => {
    const stats = simulatePreflightWatch(about.name)
    setPreflight(stats)
    setValues((c) => ({
      ...c,
      heartRate: String(stats.heartRate.mean),
      spo2: String(stats.spo2.mean),
      sleep: String(stats.sleep.mean),
    }))
    setSources((c) => ({ ...c, heartRate: 'watch-preflight', spo2: 'watch-preflight', sleep: 'watch-preflight' }))
  }

  const checks = Object.fromEntries(
    BASELINE_FIELDS.map((f) => [f.id, checkBaselineValue(f, values[f.id] ?? '')]),
  ) as Record<MeasuredIndicatorId, FieldCheck>
  const okValue = (id: MeasuredIndicatorId) => {
    const c = checks[id]
    return c?.state === 'ok' ? c.value : undefined
  }
  const pulsePressureError = checkPulsePressure(okValue('systolic'), okValue('diastolic'))
  const baselineValid =
    BASELINE_FIELDS.every((f) => {
      const c = checks[f.id]
      return f.required ? c.state === 'ok' : c.state !== 'invalid'
    }) && !pulsePressureError
  const requiredDone = BASELINE_FIELDS.filter((f) => f.required && checks[f.id].state === 'ok').length
  const requiredTotal = BASELINE_FIELDS.filter((f) => f.required).length

  const finish = async () => {
    if (saving) return
    if (!baselineValid) {
      setShowBaselineErrors(true)
      return
    }
    const defaults = defaultBaseline(figure)
    const baseline = { ...defaults } as Record<MeasuredIndicatorId, number>
    const baselineSource: Partial<Record<MeasuredIndicatorId, BaselineSource>> = {
      mood: 'default',
      exercise: 'plan',
    }
    for (const field of BASELINE_FIELDS) {
      const v = okValue(field.id)
      if (v !== undefined) {
        baseline[field.id] = v
        baselineSource[field.id] = sources[field.id] ?? 'manual'
      } else {
        baselineSource[field.id] = 'default'
      }
    }
    setSaving(true)
    setSubmitError(null)
    try {
      await createCrewProfile({
        name: about.name,
        role: about.role,
        dob: about.dob,
        missionId: about.missionId,
        figure,
        pin: about.pin,
        devices: {
          watch: watchPaired ? DEVICES[0].serial : null,
          dosimeter: pairing.dosimeter === 'paired' ? DEVICES[1].serial : null,
        },
        baseline,
        baselineSource,
      })
      navigate('/')
    } catch (error) {
      setSaving(false)
      if (error instanceof ApiError && error.details.length) {
        setSubmitError(`${error.message}: ${error.details.join('; ')}`)
      } else {
        setSubmitError(error instanceof Error ? error.message : 'Could not save the profile.')
      }
    }
  }

  const mission = MISSIONS.find((m) => m.id === about.missionId) ?? MISSIONS[0]
  const missionEnv = getEnvironment(mission.envId)

  return (
    <AuthSplit>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          {step === 0 ? (
            <AuthTabs active="signup" />
          ) : (
            <button
              type="button"
              onClick={() => setStep((c) => c - 1)}
              className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back
            </button>
          )}
          <StepIndicator current={step} />
        </div>

        {step === 0 && (
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (!aboutValid) return setShowAboutErrors(true)
              setStep(1)
            }}
          >
            <Heading
              title="Create your crew profile"
              description="Done once before launch, together with your crew medical officer. Your profile is saved in the crew database."
            />

            <Field label="Full name" htmlFor="su-name" error={showAboutErrors ? aboutErrors.name : null}>
              <input
                id="su-name"
                autoComplete="name"
                value={about.name}
                onChange={(e) => update('name', e.target.value)}
                className={inputClass}
                aria-invalid={showAboutErrors && !!aboutErrors.name}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Crew role" htmlFor="su-role">
                <select id="su-role" value={about.role} onChange={(e) => update('role', e.target.value)} className={inputClass}>
                  {CREW_ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </Field>
              <DateOfBirthInput
                value={about.dob}
                onChange={(v) => update('dob', v)}
                error={showAboutErrors ? aboutErrors.dob : null}
              />
            </div>

            <Field label="Mission" htmlFor="su-mission">
              <select
                id="su-mission"
                value={about.missionId}
                onChange={(e) => update('missionId', e.target.value)}
                className={inputClass}
              >
                {MISSIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
                <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <MissionStat label="Gravity" value={missionEnv.gravity === 0 ? 'Weightless' : missionEnv.gravityLabel} />
                  <MissionStat label="Earth delay (one way)" value={formatDelay(missionEnv.delaySeconds)} />
                  <MissionStat label="Radiation (approx.)" value={`${missionEnv.radiationPerDay} mSv/day`} />
                </dl>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Why this mission: </span>
                  {mission.why}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Your twin opens in this environment. Radiation figure source: {missionEnv.source}.
                </p>
              </div>
            </Field>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Body figure for your twin</legend>
              <div role="radiogroup" aria-label="Body figure for your twin" className="grid grid-cols-2 gap-3">
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
                        <img
                          src={`/images/body-twin-${option}.png`}
                          alt=""
                          className="absolute inset-0 size-full object-contain [mask-image:radial-gradient(ellipse_50%_56%_at_center,black_72%,transparent_100%)]"
                        />
                      </span>
                      <span className="flex flex-col">
                        <span className="font-medium">{option === 'female' ? 'Female figure' : 'Male figure'}</span>
                        <span className="text-xs text-muted-foreground">Used for the body drawing only</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={`Choose a ${PIN_LENGTH}-digit PIN`} htmlFor="su-pin" error={showAboutErrors ? aboutErrors.pin : null}>
                <PinInput id="su-pin" value={about.pin} onChange={(v) => update('pin', v)} invalid={showAboutErrors && !!aboutErrors.pin} />
              </Field>
              <Field label="Repeat PIN" htmlFor="su-pin2" error={showAboutErrors ? aboutErrors.pinConfirm : null}>
                <PinInput
                  id="su-pin2"
                  value={about.pinConfirm}
                  onChange={(v) => update('pinConfirm', v)}
                  invalid={showAboutErrors && !!aboutErrors.pinConfirm}
                />
              </Field>
            </div>

            <div className="flex flex-col gap-2">
              <Button type="submit" className="h-12 text-base">
                Continue to device pairing
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Saved in the crew database. The PIN is stored only as a salted scrypt hash, never as plain text.
              </p>
            </div>
          </form>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-5">
            <Heading
              title="Pair your devices"
              description="The watch and dosimeter send readings to your twin through a simulated device adapter. Blood pressure and temperature come from separate devices that you read yourself."
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {DEVICES.map((device) => {
                const state = pairing[device.id]
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
                    {state === 'paired' ? (
                      <span
                        role="status"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-status-ok/40 bg-status-ok/10 text-sm font-medium text-status-ok"
                      >
                        <Check className="size-4" aria-hidden />
                        Paired (simulated)
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        disabled={state === 'searching'}
                        onClick={() => pair(device.id)}
                      >
                        {state === 'searching' ? <Loader2 className="animate-spin" aria-hidden /> : <Bluetooth aria-hidden />}
                        {state === 'searching' ? 'Searching…' : 'Pair'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-semibold">What is measured, and by what</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {SENSOR_READINGS.map((reading) => {
                  const Icon = READING_ICONS[reading.key]
                  return (
                    <li key={reading.key} className="flex items-start gap-3">
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{reading.label}</span>
                        <span className="text-muted-foreground"> · {reading.note}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
                        {reading.device}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-4 rounded-xl bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
                Prototype: the watch is a fictional device and its SpO₂ sensor is a proposed design, not a validated
                spaceflight instrument. All readings in this demo are simulated.
              </p>
            </div>

            {!watchPaired && (
              <p className="flex items-start gap-3 rounded-xl border border-status-watch/40 bg-status-watch/10 p-4 text-sm leading-relaxed">
                <Info className="mt-0.5 size-4 shrink-0 text-status-watch" aria-hidden />
                You can continue without the watch and type your baseline in by hand. You can pair it later.
              </p>
            )}

            <Button type="button" className="h-12 text-base" onClick={() => setStep(2)}>
              Continue to your baseline
            </Button>
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-5">
            <Heading
              title="Record your normal"
              description="Your twin compares every reading in flight with your own pre-flight baseline, not with textbook averages. Enter the values from your L-30 to L-1 pre-flight period."
            />

            {watchPaired ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Import from your watch</p>
                    <p className="text-sm text-muted-foreground">
                      Mean of {PREFLIGHT_DAYS} pre-flight nights for heart rate, SpO₂ and sleep.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={importFromWatch}>
                    <Download aria-hidden />
                    {preflight ? 'Import again' : 'Import 30-day average'}
                  </Button>
                </div>
                {preflight && (
                  <p className="font-mono text-xs text-muted-foreground">
                    SYNTHETIC_DEMO · HR {preflight.heartRate.mean} ± {preflight.heartRate.sd} bpm · SpO₂ {preflight.spo2.mean} ±{' '}
                    {preflight.spo2.sd}% · sleep {preflight.sleep.mean} ± {preflight.sleep.sd} h · n = {preflight.heartRate.n}
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                No watch paired. Type in the values your CMO measured before launch.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {BASELINE_FIELDS.filter((f) => f.required).map((field) => (
                <BaselineInput
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ''}
                  source={sources[field.id]}
                  check={checks[field.id]}
                  showErrors={showBaselineErrors}
                  onChange={(v) => setValue(field.id, v)}
                />
              ))}
            </div>
            {pulsePressureError && (
              <p className="text-sm text-status-act" role="alert">
                {pulsePressureError}
              </p>
            )}

            <div className="rounded-2xl border border-border bg-card">
              <button
                type="button"
                aria-expanded={showOptional}
                onClick={() => setShowOptional((c) => !c)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>
                  <span className="font-medium">Optional assessments</span>
                  <span className="block text-sm text-muted-foreground">
                    Blood sugar, grip strength, near vision. If you leave them empty, a default is used and marked as
                    not personal.
                  </span>
                </span>
                <ChevronDown className={cn('size-5 shrink-0 transition-transform', showOptional && 'rotate-180')} aria-hidden />
              </button>
              {showOptional && (
                <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                  {BASELINE_FIELDS.filter((f) => !f.required).map((field) => (
                    <BaselineInput
                      key={field.id}
                      field={field}
                      value={values[field.id] ?? ''}
                      source={sources[field.id]}
                      check={checks[field.id]}
                      showErrors={showBaselineErrors}
                      onChange={(v) => setValue(field.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>

            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Normal', text: 'Close to your own baseline', tone: 'border-status-ok/40 bg-status-ok/10 text-status-ok' },
                { label: 'Watch', text: 'A change worth repeating and following', tone: 'border-status-watch/40 bg-status-watch/10 text-status-watch' },
                { label: 'Act', text: 'Large change or a demo safety limit', tone: 'border-status-act/40 bg-status-act/10 text-status-act' },
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              Each measurement has its own demo thresholds. There is no single “20% = emergency” rule. Reference
              ranges are only used to check what you type. They are not a diagnosis, and every threshold needs medical
              validation before real use.
            </p>

            {submitError && (
              <p className="flex items-start gap-2 rounded-xl border border-status-act/40 bg-status-act/10 p-3 text-sm text-status-act" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Button type="button" className="h-12 text-base" onClick={() => void finish()} disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden />}
                {saving ? 'Saving to crew database…' : 'Create profile and open my twin'}
              </Button>
              <p className="text-center text-xs text-muted-foreground" aria-live="polite">
                {requiredDone} of {requiredTotal} required readings entered
                {showBaselineErrors && !baselineValid ? '. Fix the fields marked in red.' : '.'}
              </p>
            </div>
          </section>
        )}
      </div>
    </AuthSplit>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Day / Month / Year pickers. Always shows DD/MM/YYYY whatever the browser language; stores ISO yyyy-mm-dd. */
function DateOfBirthInput({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (iso: string) => void
  error?: string | null
}) {
  const [initY, initM, initD] = value ? value.split('-') : ['', '', '']
  const [parts, setParts] = useState({ d: initD ? String(Number(initD)) : '', m: initM ? String(Number(initM)) : '', y: initY })
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 63 }, (_, i) => String(thisYear - 18 - i))
  const daysInMonth = parts.m && parts.y ? new Date(Number(parts.y), Number(parts.m), 0).getDate() : 31

  const set = (key: 'd' | 'm' | 'y', v: string) => {
    const next = { ...parts, [key]: v }
    const max = next.m && next.y ? new Date(Number(next.y), Number(next.m), 0).getDate() : 31
    if (next.d && Number(next.d) > max) next.d = String(max) // e.g. 31 → 30 when switching to April
    setParts(next)
    onChange(
      next.d && next.m && next.y ? `${next.y}-${next.m.padStart(2, '0')}-${next.d.padStart(2, '0')}` : '',
    )
  }

  const selectClass = cn(inputClass, 'px-2')
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Date of birth</legend>
      <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2">
        <select aria-label="Day" value={parts.d} onChange={(e) => set('d', e.target.value)} className={selectClass} aria-invalid={!!error}>
          <option value="">Day</option>
          {Array.from({ length: daysInMonth }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {String(i + 1).padStart(2, '0')}
            </option>
          ))}
        </select>
        <select aria-label="Month" value={parts.m} onChange={(e) => set('m', e.target.value)} className={selectClass} aria-invalid={!!error}>
          <option value="">Month</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Year" value={parts.y} onChange={(e) => set('y', e.target.value)} className={selectClass} aria-invalid={!!error}>
          <option value="">Year</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-sm text-status-act" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

function MissionStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card px-2 py-2">
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-semibold">{value}</dd>
    </div>
  )
}

function PinInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid: boolean
}) {
  return (
    <input
      id={id}
      type="password"
      inputMode="numeric"
      autoComplete="new-password"
      maxLength={PIN_LENGTH}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
      className={cn(inputClass, 'max-w-40 font-mono tracking-[0.5em]')}
      aria-invalid={invalid}
    />
  )
}

const SOURCE_LABEL: Record<BaselineSource, string> = {
  'watch-preflight': 'Watch avg',
  manual: 'Manual',
  default: 'Default',
  plan: 'Plan',
}

function BaselineInput({
  field,
  value,
  source,
  check,
  showErrors,
  onChange,
}: {
  field: BaselineField
  value: string
  source?: BaselineSource
  check: FieldCheck
  showErrors: boolean
  onChange: (v: string) => void
}) {
  const id = `bl-${field.id}`
  const error =
    check.state === 'invalid'
      ? check.message
      : showErrors && field.required && check.state === 'empty'
        ? 'Required.'
        : null
  const note = check.state === 'ok' ? check.note : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </label>
        <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
          {source && value ? SOURCE_LABEL[source] : field.device}
        </span>
      </div>
      <div className="relative">
        <input
          id={id}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.required ? '' : 'optional'}
          className={cn(inputClass, 'pr-16 font-mono')}
          aria-invalid={!!error}
          aria-describedby={`${id}-help`}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {field.unit}
        </span>
      </div>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
        {field.help}
      </p>
      {error && (
        <p className="text-xs text-status-act" role="alert">
          {error}
        </p>
      )}
      {note && (
        <p className="text-xs text-status-watch" title={field.typicalSource}>
          {note}
        </p>
      )}
    </div>
  )
}

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Sign-up progress">
      {STEPS.map((label, index) => {
        const done = index < current
        const active = index === current
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
              {done ? <Check className="size-4" aria-hidden /> : index + 1}
            </span>
            <span className={cn('hidden text-sm sm:inline', active ? 'font-medium' : 'text-muted-foreground')}>
              {label}
              {done && <span className="sr-only"> (completed)</span>}
            </span>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
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
  hint,
  children,
}: {
  label: string
  htmlFor: string
  error?: string | null
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-sm text-status-act" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
