
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronRight,
  Earth,
  Rocket,
  Bell,
  FileText,
  Download,
  Activity,
  ClipboardCheck,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDelay, isDeepSpace } from '@/lib/orbit/environments'
import {
  getRouting,
  type OrganState,
  type Status,
} from '@/lib/orbit/health'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { useOrbit } from './orbit-provider'

type SavedActionStep = {
  step_id?: string
  stepId?: string
  completed: number | boolean
}

const statusNames: Record<Status, string> = {
  normal: 'NORMAL',
  watch: 'WATCH',
  act: 'CRITICAL',
}

const statusColors: Record<Status, string> = {
  normal: 'bg-green-500/10 text-green-600 border-green-500/30',
  watch: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  act: 'bg-red-500/10 text-red-600 border-red-500/30',
}

export function ActionCenter() {
  const { alerts, organs, env, astronaut } = useOrbit()

  const clear = organs.filter((organ) => organ.status === 'normal')
  const urgentCount = alerts.filter((alert) => alert.status === 'act').length
  const watchCount = alerts.filter((alert) => alert.status === 'watch').length

  const [reportLoading, setReportLoading] = useState(false)
  const [reportMessage, setReportMessage] = useState('')

  async function createMedicalReport() {
    setReportLoading(true)
    setReportMessage('')

    const report = {
      astronaut: astronaut.name,
      astronautId: astronaut.id,
      missionEnvironment: env.name,
      earthDelaySeconds: env.delaySeconds,
      generatedAt: new Date().toISOString(),
      alerts: alerts.map((alert) => ({
        organ: alert.organ.name,
        status: alert.status,
        indicators: alert.indicators
          .filter((item) => item.status !== 'normal')
          .map((item) => ({
            name: item.meta.label,
            status: item.status,
            message: item.message,
          })),
        recommendedAction: getRouting(alert.status, env).title,
        actionSteps: alert.organ.actions[alert.status],
      })),
      normalSystems: clear.map((organ) => organ.organ.name),
    }

    try {
      const response = await fetch('/api/medical-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          astronautId: astronaut.id,
          report,
        }),
      })

      if (!response.ok) {
        throw new Error('Could not save the medical report.')
      }

      const text = [
        'ORBIT TWIN - MEDICAL REPORT',
        `Astronaut: ${report.astronaut}`,
        `Environment: ${report.missionEnvironment}`,
        `Earth communication delay: ${formatDelay(env.delaySeconds)}`,
        `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
        '',
        'HEALTH ALERTS',
        ...report.alerts.flatMap((alert) => [
          `${alert.organ}: ${alert.status.toUpperCase()}`,
          `Recommended action: ${alert.recommendedAction}`,
          ...alert.indicators.map(
            (indicator) => `- ${indicator.name}: ${indicator.message}`,
          ),
          'Action steps:',
          ...alert.actionSteps.map((step) => `- ${step}`),
          '',
        ]),
        'NORMAL SYSTEMS',
        ...report.normalSystems.map((name) => `- ${name}`),
      ].join('\n')

      const file = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'orbit-twin-medical-report.txt'
      anchor.click()
      URL.revokeObjectURL(url)

      setReportMessage(
        'Report saved to the local database and downloaded successfully.',
      )
    } catch {
      setReportMessage('Could not create the report. Please try again.')
    } finally {
      setReportLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">

      {/* PAGE HEADER */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Activity className="size-7" />
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                ORBIT TWIN / MEDICAL OPERATIONS
              </p>
              <h1 className="mt-1 text-2xl font-bold md:text-3xl">
                Action Center
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {alerts.length
                  ? 'Health alerts and recommended actions, ranked by urgency.'
                  : 'All body systems are within their normal range.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={createMedicalReport}
            disabled={reportLoading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            <FileText className="size-4" />
            {reportLoading ? 'Generating...' : 'Generate Medical Report'}
            {!reportLoading && <Download className="size-4" />}
          </button>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2">
            <Rocket className="size-4 text-primary" />
            {env.name}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-2">
            <Earth className="size-4 text-primary" />
            Earth delay: {formatDelay(env.delaySeconds)}
          </span>
        </div>

        {reportMessage && (
          <p
            role="status"
            className="relative mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600"
          >
            {reportMessage}
          </p>
        )}
      </section>

      {/* ALERT SUMMARY */}
      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Activity className="size-5" />}
          label="Active Alerts"
          value={alerts.length}
          color="text-primary"
          description="Total health alerts"
        />
        <SummaryCard
          icon={<AlertTriangle className="size-5" />}
          label="Critical"
          value={urgentCount}
          color="text-red-600"
          description="Require immediate attention"
        />
        <SummaryCard
          icon={<ClipboardCheck className="size-5" />}
          label="Watch"
          value={watchCount}
          color="text-yellow-600"
          description="Need continuous monitoring"
        />
      </section>

      {/* ALERTS */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Priority Action Queue</h2>
            <p className="text-sm text-muted-foreground">
              Highest priority alerts appear first.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {alerts.length} alerts
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-10 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-500/15">
              <CheckCircle2 className="size-9 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-green-600">
              All Systems Normal
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No active health alerts. Keep your routine while your twin
              continues monitoring your health.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {alerts.map((alert, index) => (
              <li key={alert.organ.id}>
                <AlertCard alert={alert} rank={index + 1} />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* DISTANCE AWARE DECISIONS */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Earth className="size-5" />
            </div>
            <div>
              <h2 className="font-bold">Distance-Aware Decisions</h2>
              <p className="text-sm text-muted-foreground">
                Medical response changes depending on communication distance.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[540px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="pb-3 pr-4 font-semibold">Health Level</th>
                <th className="pb-3 pr-4 font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <Earth className="size-4" /> Near Earth
                  </span>
                </th>
                <th className="pb-3 font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <Rocket className="size-4" /> Deep Space
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(['normal', 'watch', 'act'] as Status[]).map((status) => {
                const near = getRouting(status, {
                  ...env,
                  delaySeconds: 1,
                })
                const far = getRouting(status, {
                  ...env,
                  delaySeconds: 1080,
                })

                return (
                  <tr
                    key={status}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-4 pr-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-3 py-1 text-xs font-bold',
                          statusColors[status],
                        )}
                      >
                        {statusNames[status]}
                      </span>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      {near.title}
                    </td>
                    <td className="py-4 align-top">
                      {far.title}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="border-t border-border bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
          The same health signal can require a different response when
          communication with Earth is delayed.
        </p>
      </section>

      {/* NORMAL SYSTEMS */}
      {clear.length > 0 && (
        <section className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-6 text-green-600" />
            <div>
              <h2 className="font-bold text-green-600">
                Within Normal Range
              </h2>
              <p className="text-sm text-muted-foreground">
                These body systems are currently within their normal range.
              </p>
            </div>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2">
            {clear.map((organ) => (
              <li key={organ.organ.id}>
                <Link
                  to={`/organ/${organ.organ.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-background px-3 py-2 text-sm transition hover:bg-green-500/10"
                >
                  <span className="size-2 rounded-full bg-green-500" />
                  {organ.organ.name}
                  <ChevronRight className="size-3 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function SummaryCard({
  icon,
  label,
  value,
  color,
  description,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className={cn('mt-3 text-3xl font-bold', color)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function AlertCard({
  alert,
  rank,
}: {
  alert: OrganState
  rank: number
}) {
  const { astronaut, env } = useOrbit()
  const { organ, status, indicators } = alert

  const routing = getRouting(status, env)
  const style = STATUS_STYLE[status]
  const steps = organ.actions[status]
  const deepSpace = isDeepSpace(env)

  const alertKey = `${organ.id}:${status}`

  const [done, setDone] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string[]>([])
  const [saveError, setSaveError] = useState('')
  const [notifying, setNotifying] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationError, setNotificationError] = useState('')

  const reasons = indicators.filter((item) => item.status !== 'normal')
  const progress = steps.length
    ? Math.round((done.length / steps.length) * 100)
    : 0

  useEffect(() => {
    let cancelled = false

    async function loadSteps() {
      setLoading(true)
      setDone([])
      setSaveError('')

      try {
        const response = await fetch(
          `/api/action-steps?astronautId=${encodeURIComponent(astronaut.id)}&alertKey=${encodeURIComponent(alertKey)}`,
        )

        if (!response.ok) {
          throw new Error('Could not load saved action steps.')
        }

        const data = await response.json()
        const rows: SavedActionStep[] = Array.isArray(data)
          ? data
          : Array.isArray(data.steps)
            ? data.steps
            : []

        if (cancelled) return

        setDone(
          rows
            .filter((item) => Boolean(item.completed))
            .map((item) => item.step_id ?? item.stepId ?? '')
            .filter(Boolean),
        )
      } catch {
        if (!cancelled) {
          setSaveError('Could not load saved steps. Please refresh the page.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSteps()

    return () => {
      cancelled = true
    }
  }, [astronaut.id, alertKey])

  async function handleStepChange(step: string, checked: boolean) {
    const wasDone = done.includes(step)

    setDone((previous) =>
      checked
        ? [...previous.filter((item) => item !== step), step]
        : previous.filter((item) => item !== step),
    )

    setSaving((previous) => [...previous, step])
    setSaveError('')

    try {
      const response = await fetch('/api/action-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          astronautId: astronaut.id,
          alertKey,
          stepId: step,
          completed: checked,
        }),
      })

      if (!response.ok) {
        throw new Error('Could not save this step.')
      }
    } catch {
      setDone((previous) =>
        wasDone
          ? [...previous.filter((item) => item !== step), step]
          : previous.filter((item) => item !== step),
      )
      setSaveError('Could not save this step. Please try again.')
    } finally {
      setSaving((previous) => previous.filter((item) => item !== step))
    }
  }

  async function handleNotifyMedicalOfficer() {
    setNotifying(true)
    setNotificationMessage('')
    setNotificationError('')

    try {
      const response = await fetch('/api/medical-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          astronautId: astronaut.id,
          alertKey,
          recipient: routing.title,
        }),
      })

      if (!response.ok) {
        throw new Error('Could not save medical notification.')
      }

      setNotificationMessage(
        deepSpace
          ? 'Notification queued locally. Earth follow-up is awaiting the next communication window.'
          : 'Medical notification saved to the local queue.',
      )
    } catch {
      setNotificationError('Could not save notification. Please try again.')
    } finally {
      setNotifying(false)
    }
  }

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md',
        style.border,
      )}
    >
      {/* ALERT HEADER */}
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4', style.soft)}>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-full font-mono text-sm font-bold text-white',
              status === 'normal'
                ? 'bg-green-600'
                : style.bg,
            )}
          >
            {rank}
          </span>

          <div>
            <h2 className="font-bold">{organ.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {reasons.length
                ? reasons.map((item) => `${item.meta.label}: ${item.message}`).join(' · ')
                : 'Health status requires attention.'}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-bold tracking-wider',
            statusColors[status],
          )}
        >
          {statusNames[status]}
        </span>
      </div>

      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">

        {/* ROUTING AND NOTIFICATION */}
        <div>
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Medical Response
          </p>

          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-primary">
              <Rocket className="size-4" />
              <span className="text-xs font-bold uppercase">
                Recommended Handler
              </span>
            </div>

            <p className="mt-2 font-bold">{routing.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {routing.detail}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleNotifyMedicalOfficer}
              disabled={notifying}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              <Bell className="size-4" />
              {notifying ? 'Recording notification...' : 'Notify Medical Officer'}
            </button>

            <Link
              to={`/organ/${organ.id}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              Open Organ Panel
              <ChevronRight className="size-4" />
            </Link>
          </div>

          {notificationMessage && (
            <p className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-xs leading-relaxed text-green-600">
              <CheckCircle2 className="mr-1 inline size-4" />
              {notificationMessage}
            </p>
          )}

          {notificationError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {notificationError}
            </p>
          )}
        </div>

        {/* ACTION CHECKLIST */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                Action Checklist
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {done.length} of {steps.length} steps completed
              </p>
            </div>

            <span className="font-mono text-lg font-bold text-primary">
              {progress}%
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress === 100 ? 'bg-green-500' : 'bg-primary',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {progress === 100 && (
            <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-green-600">
              <CheckCircle2 className="size-4" />
              All recommended steps completed!
            </p>
          )}

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Loading saved steps...
            </p>
          ) : (
            <ol className="mt-4 flex flex-col gap-2">
              {steps.map((step, index) => {
                const checked = done.includes(step)
                const isSaving = saving.includes(step)

                return (
                  <li key={step}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-relaxed transition-all',
                        checked
                          ? 'border-green-500/30 bg-green-500/5'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50',
                        isSaving && 'opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isSaving}
                        onChange={(event) =>
                          handleStepChange(step, event.target.checked)
                        }
                        className="mt-0.5 size-4 shrink-0 accent-green-600"
                      />

                      <span
                        className={cn(
                          'font-mono text-xs',
                          checked ? 'text-green-600' : 'text-muted-foreground',
                        )}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>

                      <span
                        className={cn(
                          'flex-1',
                          checked && 'text-muted-foreground line-through',
                        )}
                      >
                        {step}
                      </span>

                      {checked && (
                        <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                      )}

                      {isSaving && (
                        <span className="text-xs text-muted-foreground">
                          Saving...
                        </span>
                      )}
                    </label>
                  </li>
                )
              })}
            </ol>
          )}

          {saveError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {saveError}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
