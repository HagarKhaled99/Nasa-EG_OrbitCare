/**
 * /actions (Member 5). Page from the original project, linked to Salma's API:
 *  - alerts in order of urgency, each with numbered steps whose ticks are saved (POST /api/action-steps);
 *  - an emergency banner for Act alerts (plan §7): reason, last valid values, "Do this now", notify the onboard
 *    medical officer (POST /api/medical-notifications), Medical Report Packet, log acknowledgment;
 *  - distance from Earth changes WHO you contact, never how serious it is.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, CheckCircle2, ChevronRight, Earth, Loader2, Rocket, Siren } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { formatDelay, isDeepSpace } from '@/lib/orbit/environments'
import { getRouting, type OrganState, type Status } from '@/lib/orbit/health'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { SYMPTOMS } from '@/lib/orbit/symptoms'
import {
  ACK_STEP,
  alertKeyFor,
  fetchActionSteps,
  fetchNotifications,
  notifyMedicalOfficer,
  saveActionStep,
  type MedicalNotification,
} from '@/lib/orbit/api/actions-api'
import { MedicalReportDialog } from './medical-report-dialog'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'
import { StatusPill } from './status-pill'

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Ticked steps + medical-officer notifications for the signed-in astronaut, kept in the crew database. */
function useActionState() {
  const [done, setDone] = useState<Record<string, string>>({}) // `${alertKey}|${stepId}` → updated_at
  const [notes, setNotes] = useState<MedicalNotification[]>([])
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchActionSteps()
        setDone(Object.fromEntries(rows.filter((r) => r.completed).map((r) => [`${r.alert_key}|${r.step_id}`, r.updated_at])))
        setNotes(await fetchNotifications())
      } catch {
        setOffline(true)
      }
    })()
  }, [])

  const toggle = useCallback(async (alertKey: string, stepId: string, completed: boolean) => {
    const key = `${alertKey}|${stepId}`
    setDone((prev) => {
      const next = { ...prev }
      if (completed) next[key] = new Date().toISOString()
      else delete next[key]
      return next
    })
    try {
      await saveActionStep(alertKey, stepId, completed)
    } catch {
      setOffline(true)
    }
  }, [])

  const notify = useCallback(async (alertKey: string, recipient: string) => {
    try {
      const note = await notifyMedicalOfficer(alertKey, recipient)
      setNotes((prev) => [note, ...prev])
      return true
    } catch {
      setOffline(true)
      return false
    }
  }, [])

  return { done, notes, offline, toggle, notify }
}

type ActionState = ReturnType<typeof useActionState>

export function ActionCenter() {
  const { alerts, organs, env } = useOrbit()
  const clear = organs.filter((o) => o.status === 'normal')
  const actions = useActionState()
  const urgent = alerts.filter((a) => a.status === 'act')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Action Center"
        title={alerts.length ? 'What to do, in order of urgency' : 'Nothing needs action today'}
        description={`Steps adapt to where you are. In ${env.name} Earth is ${formatDelay(env.delaySeconds)} away (one way).`}
      >
        <MedicalReportDialog urgent={urgent.length > 0} />
      </PageHeader>

      {actions.offline && (
        <p role="status" className="rounded-xl border border-status-watch/40 bg-status-watch/10 p-3 text-sm">
          The crew server is not reachable. Your ticks are kept on this tablet and are not saved yet.
        </p>
      )}

      {urgent.map((alert) => (
        <EmergencyBanner key={alert.organ.id} alert={alert} actions={actions} />
      ))}

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-status-ok/40 bg-card p-10 text-center">
          <CheckCircle2 className="size-10 text-status-ok" aria-hidden />
          <p className="text-lg font-semibold">All body systems are within your normal.</p>
          <p className="text-sm text-muted-foreground">Keep your routine. Your twin is watching for drift.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {alerts.map((alert, i) => (
            <li key={alert.organ.id}>
              <AlertCard alert={alert} rank={i + 1} actions={actions} />
            </li>
          ))}
        </ol>
      )}

      <section aria-labelledby="distance-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="distance-title" className="text-lg font-semibold">
          Distance-aware decisions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The same finding needs a different contact depending on how far you are from Earth. How serious it is does not
          change.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Level</th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Earth className="size-3.5" aria-hidden /> ISS · Lunar orbit · Moon base
                  </span>
                </th>
                <th scope="col" className="py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Rocket className="size-3.5" aria-hidden /> Mars transit · Mars base
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(['normal', 'watch', 'act'] as Status[]).map((s) => {
                const near = getRouting(s, { ...env, delaySeconds: 1 })
                const far = getRouting(s, { ...env, delaySeconds: 1080 })
                const deep = isDeepSpace(env)
                return (
                  <tr key={s} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="py-3 pr-4 align-top font-normal">
                      <StatusPill status={s} />
                    </th>
                    <td className={cn('py-3 pr-4 align-top', !deep && 'font-medium text-foreground')}>{near.title}</td>
                    <td className={cn('py-3 align-top', deep ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {far.title}
                      {s === 'act' && ' + Medical Report Packet sent to Earth'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {clear.length > 0 && (
        <section aria-labelledby="clear-title">
          <h2 id="clear-title" className="mb-3 text-sm font-medium text-muted-foreground">
            Within your normal
          </h2>
          <ul className="flex flex-wrap gap-2">
            {clear.map((o) => (
              <li key={o.organ.id}>
                <Link
                  to={`/organ/${o.organ.id}`}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
                >
                  <span aria-hidden className="size-2 rounded-full bg-status-ok" />
                  {o.organ.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Why this system is flagged: out-of-range readings and symptoms reported at today's check-in. */
function reasonsFor(alert: OrganState, symptomsToday: string[]) {
  const readings = alert.indicators
    .filter((i) => i.status !== 'normal' && Number.isFinite(i.value))
    .map((i) => `${i.meta.label}: ${i.message}`)
  const symptoms = SYMPTOMS.filter((s) => s.organ === alert.organ.id && symptomsToday.includes(s.id)).map(
    (s) => `Reported: ${s.label.toLowerCase()}${s.level === 'act' ? ' (urgent)' : ''}`,
  )
  return [...symptoms, ...readings]
}

function NotifyButton({
  alertKey,
  recipient,
  actions,
  className,
}: {
  alertKey: string
  recipient: string
  actions: ActionState
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const sent = actions.notes.find((n) => n.alert_key === alertKey)
  if (sent) {
    return (
      <p role="status" className={cn('flex items-center gap-2 text-sm text-status-ok', className)}>
        <CheckCircle2 className="size-4" aria-hidden />
        {sent.recipient} notified at {time(sent.created_at)} ({sent.status})
      </p>
    )
  }
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await actions.notify(alertKey, recipient)
        setBusy(false)
      }}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
      Notify onboard medical officer
    </Button>
  )
}

function EmergencyBanner({ alert, actions }: { alert: OrganState; actions: ActionState }) {
  const { env, symptomsToday } = useOrbit()
  const routing = getRouting('act', env)
  const alertKey = alertKeyFor(alert.organ.id, MISSION_DAY, 'act')
  const ackAt = actions.done[`${alertKey}|${ACK_STEP}`]
  const lastValid = alert.indicators
    .filter((i) => i.id !== 'crewPulse')
    .map((i) => {
      const last = [...i.history].reverse().find((p) => Number.isFinite(p.value))
      return { label: i.meta.label, unit: i.meta.unit, decimals: i.meta.decimals, last }
    })
    .filter((x) => x.last)

  return (
    <section
      role="alert"
      aria-labelledby={`emergency-${alert.organ.id}`}
      className="overflow-hidden rounded-2xl border-2 border-status-act bg-status-act/10"
    >
      <div className="flex flex-wrap items-center gap-3 bg-status-act px-5 py-3 text-white">
        <Siren className="size-5 shrink-0" aria-hidden />
        <p className="font-mono text-xs font-semibold tracking-[0.2em] uppercase">Demo alert · Act now</p>
        <h2 id={`emergency-${alert.organ.id}`} className="text-lg font-semibold">
          {alert.organ.name}
        </h2>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Reason</p>
            <ul className="mt-1 list-disc pl-5">
              {reasonsFor(alert, symptomsToday).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          {lastValid.length > 0 && (
            <div>
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Last valid values</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                {lastValid.map((v) => (
                  <div key={v.label} className="contents">
                    <dt className="truncate font-sans text-muted-foreground">{v.label}</dt>
                    <dd>
                      {v.last!.value.toFixed(v.decimals)} {v.unit} · day {v.last!.day}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <p>
            <span className="font-medium">Contact:</span> {routing.contact}. {routing.detail}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-status-act/40 bg-card p-4">
            <p className="font-semibold">Do this now</p>
            <ol className="mt-2 flex flex-col gap-2 text-sm">
              {alert.organ.actions.act.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-status-act font-mono text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Placeholder steps. Follow your approved onboard protocol; this demo does not give treatments or doses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotifyButton alertKey={alertKey} recipient="Crew medical officer" actions={actions} />
            {ackAt ? (
              <p role="status" className="flex items-center gap-2 text-sm text-status-ok">
                <CheckCircle2 className="size-4" aria-hidden />
                Acknowledged at {time(ackAt)}
              </p>
            ) : (
              <Button type="button" variant="outline" onClick={() => void actions.toggle(alertKey, ACK_STEP, true)}>
                I have read this alert
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function AlertCard({ alert, rank, actions }: { alert: OrganState; rank: number; actions: ActionState }) {
  const { env, symptomsToday } = useOrbit()
  const { organ, status } = alert
  const routing = getRouting(status, env)
  const style = STATUS_STYLE[status]
  const steps = organ.actions[status]
  const alertKey = alertKeyFor(organ.id, MISSION_DAY, status)
  const doneCount = steps.filter((s) => actions.done[`${alertKey}|${s}`]).length

  return (
    <article className={cn('overflow-hidden rounded-2xl border bg-card', style.border)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-4', style.soft)}>
        <div className="flex items-center gap-3">
          <span
            className={cn('flex size-8 items-center justify-center rounded-full font-mono text-sm font-semibold text-background', style.bg)}
          >
            {rank}
          </span>
          <div>
            <h2 className="font-semibold">{organ.name}</h2>
            <p className="text-sm text-muted-foreground">{reasonsFor(alert, symptomsToday).join(' · ')}</p>
          </div>
        </div>
        <StatusPill status={status} size="lg" />
      </div>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Who handles it</p>
          <p className="mt-1 font-semibold">{routing.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{routing.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink variant="outline" to={`/organ/${organ.id}`}>
              Open organ panel
              <ChevronRight aria-hidden />
            </ButtonLink>
            {status === 'watch' && <NotifyButton alertKey={alertKey} recipient="Crew medical officer" actions={actions} />}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Steps ({doneCount}/{steps.length} done)
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {steps.map((step) => {
              const checked = Boolean(actions.done[`${alertKey}|${step}`])
              return (
                <li key={step}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm leading-relaxed transition-colors hover:bg-secondary',
                      checked && 'border-status-ok/40 bg-status-ok/10 text-muted-foreground line-through',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => void actions.toggle(alertKey, step, !checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--status-ok)]"
                    />
                    {step}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </article>
  )
}
