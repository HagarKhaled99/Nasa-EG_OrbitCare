'use client'

import { useState } from 'react'
import { Download, FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { MISSION_DAY, MISSION_NAME } from '@/lib/orbit/crew'
import { formatDelay } from '@/lib/orbit/environments'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { useOrbit } from './orbit-provider'

export function MedicalReportDialog() {
  const { astronaut, env, alerts, reportsSent, sendReport, votes } = useOrbit()
  const [justSent, setJustSent] = useState(false)
  const urgent = alerts.some((a) => a.status === 'act')

  const lines: string[] = [
    `ORBIT TWIN – MEDICAL REPORT PACKET`,
    `Mission ${MISSION_NAME} · Day ${MISSION_DAY} · ${env.name}`,
    `Astronaut: ${astronaut.name} (${astronaut.role})`,
    `One-way delay: ${formatDelay(env.delaySeconds)}`,
    '',
    'FINDINGS',
  ]
  for (const alert of alerts) {
    lines.push(`- ${alert.organ.name}: ${STATUS_STYLE[alert.status].label.toUpperCase()}`)
    for (const ind of alert.indicators.filter((i) => i.status !== 'normal')) {
      const last7 = ind.history
        .slice(-7)
        .map((p) => p.value.toFixed(ind.meta.decimals))
        .join(', ')
      lines.push(
        `    ${ind.meta.label}: ${ind.value.toFixed(ind.meta.decimals)} ${ind.meta.unit} (normal ${ind.baseline.toFixed(ind.meta.decimals)}) – ${ind.message}`,
      )
      if (ind.id !== 'crewPulse') lines.push(`    Last 7 days: ${last7}`)
    }
  }
  lines.push('', `Crew Pulse: ${votes.filter((v) => !v.seemsLikeThemselves).length}/${votes.length} crewmates flagged a change`)
  lines.push('', 'ONBOARD ACTIONS STARTED')
  for (const alert of alerts) lines.push(`- ${alert.organ.name}: ${alert.organ.actions[alert.status][0]}`)
  const report = lines.join('\n')

  const download = () => {
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `orbit-twin-report-${astronaut.id}-day${MISSION_DAY}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog onOpenChange={(open) => !open && setJustSent(false)}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            variant={urgent ? 'destructive' : 'outline'}
            className="h-11 px-4"
          />
        }
      >
        <FileText aria-hidden />
        Medical Report Packet
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Medical Report Packet</DialogTitle>
          <DialogDescription>
            Generated from your twin. Flight surgeons receive it in about {formatDelay(env.delaySeconds)}.
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {report}
        </pre>
        <p aria-live="polite" className="text-sm text-status-ok">
          {justSent
            ? `Queued for transmission. Arrives at Earth in ~${formatDelay(env.delaySeconds)}.`
            : reportsSent > 0
              ? `${reportsSent} report${reportsSent > 1 ? 's' : ''} sent today.`
              : ''}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={download}>
            <Download aria-hidden />
            Download
          </Button>
          <Button
            onClick={() => {
              sendReport()
              setJustSent(true)
            }}
          >
            <Send aria-hidden />
            Send to Earth
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
