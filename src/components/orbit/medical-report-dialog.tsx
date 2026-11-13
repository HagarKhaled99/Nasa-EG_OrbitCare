/**
 * Medical Report Packet (Member 5). From the original project, ported to the Vite app: native <dialog>,
 * the packet is queued on the server (POST /api/medical-reports, Salma's API) and can be downloaded as text.
 */
import { useRef, useState } from 'react'
import { Download, FileText, Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MISSION_DAY, MISSION_NAME } from '@/lib/orbit/crew'
import { formatDelay } from '@/lib/orbit/environments'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { SYMPTOMS } from '@/lib/orbit/symptoms'
import { useOrbit } from './orbit-provider'

/** Plain-text packet: findings, last valid values, symptoms, crew pulse and onboard actions. */
export function useReportText() {
  const { astronaut, env, alerts, votes, symptomsToday } = useOrbit()
  const lines: string[] = [
    'ORBIT TWIN – MEDICAL REPORT PACKET (SYNTHETIC DEMO DATA – NOT A REAL ASTRONAUT)',
    `Mission ${MISSION_NAME} · Day ${MISSION_DAY} · ${env.name}`,
    `Astronaut: ${astronaut.name} (${astronaut.role})`,
    `Generated: ${new Date().toISOString()} · one-way delay to Earth: ${formatDelay(env.delaySeconds)}`,
    '',
    'FINDINGS',
  ]
  if (alerts.length === 0) lines.push('- All body systems within personal normal.')
  for (const alert of alerts) {
    lines.push(`- ${alert.organ.name}: ${STATUS_STYLE[alert.status].label.toUpperCase()}`)
    for (const ind of alert.indicators.filter((i) => i.status !== 'normal' && Number.isFinite(i.value))) {
      const last7 = ind.history
        .slice(-7)
        .map((p) => (Number.isFinite(p.value) ? p.value.toFixed(ind.meta.decimals) : 'missing'))
        .join(', ')
      lines.push(
        `    ${ind.meta.label}: ${ind.value.toFixed(ind.meta.decimals)} ${ind.meta.unit} (normal ${ind.baseline.toFixed(ind.meta.decimals)}) – ${ind.message}`,
      )
      if (ind.id !== 'crewPulse') lines.push(`    Last 7 days: ${last7}`)
    }
  }
  const symptoms = SYMPTOMS.filter((s) => symptomsToday.includes(s.id))
  lines.push('', 'SYMPTOMS REPORTED TODAY')
  lines.push(...(symptoms.length ? symptoms.map((s) => `- ${s.label}${s.level === 'act' ? ' (URGENT)' : ''}`) : ['- None']))
  lines.push('', `Crew Pulse: ${votes.filter((v) => !v.seemsLikeThemselves).length}/${votes.length} crewmates noticed a change`)
  lines.push('', 'ONBOARD ACTIONS STARTED')
  for (const alert of alerts) lines.push(`- ${alert.organ.name}: ${alert.organ.actions[alert.status][0]}`)
  lines.push('', 'Demo thresholds and placeholder protocols. Not medical advice.')
  return { text: lines.join('\n'), alerts: alerts.map((a) => ({ organ: a.organ.id, status: a.status })), symptoms: symptomsToday }
}

export function MedicalReportDialog({ urgent = false }: { urgent?: boolean }) {
  const { astronaut, env, reportsSent, sendReport } = useOrbit()
  const ref = useRef<HTMLDialogElement>(null)
  const report = useReportText()
  const [state, setState] = useState<'idle' | 'sending' | 'database' | 'tablet-only'>('idle')

  const download = () => {
    const blob = new Blob([report.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orbit-twin-report-${astronaut.id}-day${MISSION_DAY}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const send = async () => {
    setState('sending')
    setState(await sendReport({ ...report, missionDay: MISSION_DAY, environment: env.id }))
  }

  return (
    <>
      <Button
        type="button"
        variant={urgent ? 'default' : 'outline'}
        className={cn('h-11 px-4', urgent && 'bg-status-act text-white hover:bg-status-act/85')}
        onClick={() => {
          setState('idle')
          ref.current?.showModal()
        }}
      >
        <FileText aria-hidden />
        Medical Report Packet
      </Button>
      <dialog
        ref={ref}
        aria-labelledby="report-title"
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close()
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="report-title" className="text-lg font-semibold">
                Medical Report Packet
              </h2>
              <p className="text-sm text-muted-foreground">
                Generated from your twin. Flight surgeons receive it about {formatDelay(env.delaySeconds)} after it is sent.
              </p>
            </div>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {report.text}
          </pre>
          <p aria-live="polite" className="text-sm text-status-ok">
            {state === 'database'
              ? `Queued in the crew database for the next comms window. Arrives about ${formatDelay(env.delaySeconds)} after sending.`
              : state === 'tablet-only'
                ? 'The crew server is not reachable: kept on this tablet only. Download it to be safe.'
                : reportsSent > 0
                  ? `${reportsSent} report${reportsSent > 1 ? 's' : ''} queued today.`
                  : ''}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={download}>
              <Download aria-hidden />
              Download
            </Button>
            <Button type="button" onClick={() => void send()} disabled={state === 'sending'}>
              {state === 'sending' ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              Queue for Earth
            </Button>
          </div>
        </div>
      </dialog>
    </>
  )
}
