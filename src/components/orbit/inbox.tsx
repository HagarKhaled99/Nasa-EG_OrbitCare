/**
 * /inbox (astronaut portal): advice from the flight surgeon on Earth and your fitness for duty.
 * Messages travel with the real one-way delay: a message still crossing space shows when it will arrive,
 * but cannot be read yet.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  History,
  Globe2,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDelay } from '@/lib/orbit/environments'
import { getOrgan } from '@/lib/orbit/organs'
import { FITNESS_LABEL, arrivesIn, markAdviceRead, type FitnessStatus } from '@/lib/orbit/api/ground-api'
import { fetchReports, type MedicalReport } from '@/lib/orbit/api/actions-api'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const FITNESS_STYLE: Record<FitnessStatus, { icon: typeof ShieldCheck; tone: string }> = {
  ready: { icon: ShieldCheck, tone: 'border-status-ok/40 bg-status-ok/10 text-status-ok' },
  limited: { icon: ShieldAlert, tone: 'border-status-watch/40 bg-status-watch/10 text-status-watch' },
  'not-ready': { icon: ShieldX, tone: 'border-status-act/40 bg-status-act/10 text-status-act' },
}

/** One line describing what a packet carried, e.g. "Heart: Act · Brain: Watch · 1 symptom". */
function packetSummary(report: MedicalReport['report']) {
  const alerts = Array.isArray(report.alerts) ? (report.alerts as Array<{ organ: string; status: string }>) : []
  const symptoms = Array.isArray(report.symptoms) ? report.symptoms.length : 0
  const parts = alerts.map((a) => `${getOrgan(a.organ)?.name ?? a.organ}: ${a.status === 'act' ? 'Act' : 'Watch'}`)
  if (symptoms) parts.push(`${symptoms} symptom${symptoms === 1 ? '' : 's'}`)
  return parts.length ? parts.join(' · ') : 'No alerts: routine check'
}

export function InboxPage() {
  const { astronaut, inbox, refreshInbox } = useOrbit()
  const [, setTick] = useState(0)
  const [marking, setMarking] = useState<string | null>(null)
  const [sent, setSent] = useState<MedicalReport[] | null>(null)

  // Your own packets only (the crew medical officer's GET returns everyone's).
  const loadSent = useCallback(async () => {
    try {
      const rows = await fetchReports()
      setSent(rows.filter((r) => r.astronaut_id === astronaut.id))
    } catch {
      setSent((prev) => prev ?? [])
    }
  }, [astronaut.id])

  // Re-render every 5 s so "arrives in …" counts down; refresh when something should have arrived.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 5000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    void refreshInbox()
    void loadSent()
    // Picks up the demo "skip light delay" too.
    const timer = window.setInterval(() => void loadSent(), 15_000)
    return () => window.clearInterval(timer)
  }, [refreshInbox, loadSent])

  const fitness = inbox?.fitness ?? null
  const style = fitness ? FITNESS_STYLE[fitness.status] : null
  const messages = inbox?.messages ?? []
  const now = Date.now()

  // Nothing is deleted (it is the astronaut's medical record). Handled items move to a collapsed "Earlier" list:
  // a message once it is read; a packet once the flight surgeon has replied after it reached Earth.
  const openMessages = messages.filter((m) => !m.arrived || !m.read_at)
  const doneMessages = messages.filter((m) => m.arrived && m.read_at)
  const packetArrival = (r: MedicalReport) => Date.parse(r.arrives_at ?? r.created_at)
  const isAnswered = (r: MedicalReport) =>
    packetArrival(r) <= now && messages.some((m) => Date.parse(m.sent_at) >= packetArrival(r))
  const openPackets = (sent ?? []).filter((r) => !isAnswered(r))
  const donePackets = (sent ?? []).filter(isAnswered)

  const renderMessage = (m: (typeof messages)[number]) =>
    m.arrived ? (
      <li
        key={m.id}
        className={cn('rounded-2xl border bg-card p-5', m.read_at ? 'border-border' : 'border-primary/50 shadow-sm')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-medium">
            {m.read_at ? (
              <MailOpen className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <Mail className="size-4 text-primary" aria-hidden />
            )}
            {m.from_name}
            {!m.read_at && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">New</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            Sent {when(m.sent_at)} · arrived {when(m.arrives_at)}
          </p>
        </div>
        <p className="mt-3 text-base leading-relaxed whitespace-pre-wrap">{m.body}</p>
        {!m.read_at && (
          <Button
            type="button"
            variant="outline"
            className="mt-3 h-9"
            disabled={marking === m.id}
            onClick={async () => {
              setMarking(m.id)
              try {
                await markAdviceRead(m.id)
              } finally {
                await refreshInbox()
                setMarking(null)
              }
            }}
          >
            {marking === m.id ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
            Mark as read
          </Button>
        )}
      </li>
    ) : (
      <li key={m.id} className="flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Globe2 className="size-5 animate-pulse motion-reduce:animate-none" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">A message from {m.from_name} is on its way</p>
          <p className="text-sm text-muted-foreground">
            Sent {when(m.sent_at)} · arrives {arrivesIn(m.arrives_at)}. You can read it once it reaches the ship.
          </p>
        </div>
      </li>
    )

  const renderPacket = (r: MedicalReport, answered: boolean) => {
    const arrivesAt = r.arrives_at ?? r.created_at
    const delivered = Date.parse(arrivesAt) <= now
    const badge = answered ? 'Answered' : delivered ? 'Delivered to Earth' : 'On its way'
    return (
      <li key={r.id} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            delivered ? 'bg-status-ok/15 text-status-ok' : 'bg-primary/10 text-primary',
          )}
        >
          {delivered ? (
            <CheckCircle2 className="size-5" aria-hidden />
          ) : (
            <Globe2 className="size-5 animate-pulse motion-reduce:animate-none" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium">
              <FileText className="size-4 text-muted-foreground" aria-hidden />
              Medical Report Packet
              {typeof r.report.missionDay === 'number' && (
                <span className="text-sm font-normal text-muted-foreground">· day {r.report.missionDay}</span>
              )}
            </p>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                delivered ? 'bg-status-ok/15 text-status-ok' : 'bg-primary/10 text-primary',
              )}
            >
              {badge}
            </span>
          </div>
          <p className="mt-1 text-sm">{packetSummary(r.report)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent {when(r.created_at)} ·{' '}
            {answered
              ? `reached Earth ${when(arrivesAt)}. Your flight surgeon replied.`
              : delivered
                ? `reached Earth ${when(arrivesAt)}. Waiting for your flight surgeon's reply.`
                : `reaches Earth ${arrivesIn(arrivesAt)} (${when(arrivesAt)}).`}
          </p>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Inbox · from the ground team"
        title="Advice from Earth"
        description={`Your flight surgeon reads your report packets and replies here. Every message crosses space with the one-way delay${
          inbox ? ` (${formatDelay(inbox.delaySeconds)} for your mission)` : ''
        }. In an emergency, act with your crew medical officer first; do not wait for Earth.`}
      />

      <section
        aria-labelledby="fitness-title"
        className={cn('rounded-2xl border bg-card p-5', style ? style.tone : 'border-border')}
      >
        <h2 id="fitness-title" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {style ? <style.icon className="size-5" aria-hidden /> : <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />}
          Fitness for duty: {fitness ? FITNESS_LABEL[fitness.status] : 'no decision yet'}
        </h2>
        {fitness ? (
          <div className="mt-2 flex flex-col gap-1 text-sm text-foreground">
            {fitness.restrictions && (
              <p>
                <span className="font-medium">Restrictions:</span> {fitness.restrictions}
              </p>
            )}
            {fitness.medical_note && (
              <p>
                <span className="font-medium">Note from your flight surgeon:</span> {fitness.medical_note}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {fitness.decided_by} · {when(fitness.decided_at)}. Mission management only sees the status and
              restrictions, never your medical details.
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Your flight surgeon has not made a fitness-for-duty decision for you today.
          </p>
        )}
      </section>

      <section aria-labelledby="advice-title" className="flex flex-col gap-3">
        <h2 id="advice-title" className="text-lg font-semibold">
          Messages
        </h2>
        {inbox === null ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Loading your inbox… If this stays, the crew server is not reachable.
          </p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <InboxIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No messages from Earth yet.</p>
            {sent && sent.length > 0 ? (
              <p className="max-w-md text-sm text-muted-foreground">
                Your flight surgeon&apos;s reply will appear here. It needs your packet to reach Earth, then the same
                delay to travel back.
              </p>
            ) : (
              <>
                <p className="max-w-md text-sm text-muted-foreground">
                  Send a Medical Report Packet from the Action Center; your flight surgeon answers here.
                </p>
                <ButtonLink to="/actions" variant="outline">
                  Open Action Center
                </ButtonLink>
              </>
            )}
          </div>
        ) : openMessages.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-status-ok" aria-hidden />
            All caught up. Messages you have read are under Earlier.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">{openMessages.map(renderMessage)}</ul>
        )}
      </section>

      <section aria-labelledby="sent-title" className="flex flex-col gap-3">
        <h2 id="sent-title" className="flex items-center gap-2 text-lg font-semibold">
          <Send className="size-4 text-muted-foreground" aria-hidden />
          Sent to Earth
        </h2>
        {sent === null ? (
          <p className="text-sm text-muted-foreground">Loading your sent packets…</p>
        ) : sent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            You have not sent a Medical Report Packet yet.
          </p>
        ) : openPackets.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-status-ok" aria-hidden />
            Every packet you sent has been answered. They are under Earlier.
          </p>
        ) : (
          <ul className="flex flex-col gap-3" aria-live="polite">
            {openPackets.map((r) => renderPacket(r, false))}
          </ul>
        )}
      </section>

      {doneMessages.length + donePackets.length > 0 && (
        <details className="group rounded-2xl border border-border bg-card/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-5 font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden />
              Earlier ({doneMessages.length + donePackets.length})
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="flex flex-col gap-3 px-5 pb-5">
            <p className="text-sm text-muted-foreground">
              Read messages and answered packets. They stay in your medical record; they are only moved out of the way.
            </p>
            <ul className="flex flex-col gap-3">
              {doneMessages.map(renderMessage)}
              {donePackets.map((r) => renderPacket(r, true))}
            </ul>
          </div>
        </details>
      )}
    </div>
  )
}
