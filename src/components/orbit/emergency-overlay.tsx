/**
 * Full-screen emergency alert (plan §7: "full-screen banner + reason + last valid values + Do this now +
 * notify onboard medical officer + log acknowledgment"). Shown on any page while an Act alert has not been
 * acknowledged. Acknowledgment is stored with Salma's action-steps API; "Not now" hides it until a new alert.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BellRing, Loader2, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MISSION_DAY } from '@/lib/orbit/crew'
import { getRouting } from '@/lib/orbit/health'
import { SYMPTOMS } from '@/lib/orbit/symptoms'
import {
  ACK_STEP,
  alertKeyFor,
  fetchActionSteps,
  notifyMedicalOfficer,
  saveActionStep,
} from '@/lib/orbit/api/actions-api'
import { useOrbit } from './orbit-provider'

export function EmergencyOverlay() {
  const { alerts, env, symptomsToday, session } = useOrbit()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [acknowledged, setAcknowledged] = useState<Set<string> | null>(null)
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [notified, setNotified] = useState(false)
  const actButton = useRef<HTMLButtonElement>(null)

  const urgent = alerts.filter((a) => a.status === 'act')
  const keys = useMemo(() => urgent.map((a) => alertKeyFor(a.organ.id, MISSION_DAY, 'act')), [urgent])

  // Which Act alerts were already acknowledged (stored in the crew database).
  useEffect(() => {
    if (!session) return
    void fetchActionSteps()
      .then((rows) => setAcknowledged(new Set(rows.filter((r) => r.step_id === ACK_STEP && r.completed).map((r) => r.alert_key))))
      .catch(() => setAcknowledged(new Set()))
  }, [session, keys.join('|')])

  const open = urgent.filter((a, i) => !acknowledged?.has(keys[i]) && !snoozed.has(keys[i]))
  const show = acknowledged !== null && open.length > 0 && pathname !== '/actions'

  useEffect(() => {
    if (show) actButton.current?.focus()
  }, [show])

  if (!show) return null
  const alert = open[0]
  const key = alertKeyFor(alert.organ.id, MISSION_DAY, 'act')
  const routing = getRouting('act', env)
  const reasons = [
    ...SYMPTOMS.filter((s) => s.organ === alert.organ.id && symptomsToday.includes(s.id)).map((s) => `You reported: ${s.label.toLowerCase()}`),
    ...alert.indicators.filter((i) => i.status === 'act' && Number.isFinite(i.value)).map((i) => `${i.meta.label}: ${i.message}`),
  ]
  const lastValid = alert.indicators
    .filter((i) => i.id !== 'crewPulse' && Number.isFinite(i.value))
    .map((i) => `${i.meta.label} ${i.value.toFixed(i.meta.decimals)} ${i.meta.unit}`)

  const acknowledge = async () => {
    setBusy(true)
    try {
      await saveActionStep(key, ACK_STEP, true)
    } catch {
      /* offline: still close it on this tablet */
    }
    setAcknowledged((prev) => new Set([...(prev ?? []), key]))
    setBusy(false)
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-reason"
      className="fixed inset-0 z-50 flex items-center justify-center bg-status-act/90 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center gap-3 bg-status-act px-6 py-4 text-white">
          <Siren className="size-7 shrink-0 animate-pulse motion-reduce:animate-none" aria-hidden />
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] uppercase">Demo alert · Act now</p>
            <h2 id="emergency-title" className="text-2xl font-semibold">
              {alert.organ.name}
            </h2>
          </div>
          {open.length > 1 && <span className="ml-auto rounded-full bg-white/20 px-3 py-1 text-sm">+{open.length - 1} more</span>}
        </div>
        <div className="flex flex-col gap-4 p-6">
          <ul id="emergency-reason" className="list-disc pl-5 text-base font-medium">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {lastValid.length > 0 && (
            <p className="font-mono text-sm text-muted-foreground">Last valid values: {lastValid.join(' · ')}</p>
          )}
          <div className="rounded-2xl border border-status-act/40 bg-status-act/5 p-4">
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
          </div>
          <p className="text-sm">
            <span className="font-semibold">Contact:</span> {routing.contact}. Distance from Earth changes who you contact,
            not how serious this is.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              ref={actButton}
              type="button"
              className="h-12 bg-status-act px-5 text-base text-white hover:bg-status-act/85"
              onClick={() => {
                setSnoozed((prev) => new Set([...prev, key]))
                navigate('/actions')
              }}
            >
              <Siren aria-hidden />
              Open Action Center
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 px-5"
              disabled={notified}
              onClick={async () => {
                try {
                  await notifyMedicalOfficer(key, 'Crew medical officer')
                } catch {
                  /* shown as queued on this tablet */
                }
                setNotified(true)
              }}
            >
              <BellRing aria-hidden />
              {notified ? 'Medical officer notified' : 'Notify medical officer'}
            </Button>
            <Button type="button" variant="outline" className="h-12 px-5" disabled={busy} onClick={() => void acknowledge()}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}I have read this
            </Button>
            <button
              type="button"
              onClick={() => setSnoozed((prev) => new Set([...prev, key]))}
              className="ml-auto self-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Not now
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Demo thresholds and placeholder protocol steps on synthetic data. Not medical advice.
          </p>
        </div>
      </div>
    </div>
  )
}
