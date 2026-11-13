/**
 * /inbox (astronaut portal): advice from the flight surgeon on Earth and your fitness for duty.
 * Messages travel with the real one-way delay: a message still crossing space shows when it will arrive,
 * but cannot be read yet.
 */
import { useEffect, useState } from 'react'
import { CheckCircle2, Globe2, Inbox as InboxIcon, Loader2, Mail, MailOpen, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatDelay } from '@/lib/orbit/environments'
import { FITNESS_LABEL, arrivesIn, markAdviceRead, type FitnessStatus } from '@/lib/orbit/api/ground-api'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const FITNESS_STYLE: Record<FitnessStatus, { icon: typeof ShieldCheck; tone: string }> = {
  ready: { icon: ShieldCheck, tone: 'border-status-ok/40 bg-status-ok/10 text-status-ok' },
  limited: { icon: ShieldAlert, tone: 'border-status-watch/40 bg-status-watch/10 text-status-watch' },
  'not-ready': { icon: ShieldX, tone: 'border-status-act/40 bg-status-act/10 text-status-act' },
}

export function InboxPage() {
  const { inbox, refreshInbox } = useOrbit()
  const [, setTick] = useState(0)
  const [marking, setMarking] = useState<string | null>(null)

  // Re-render every 5 s so "arrives in …" counts down; refresh when something should have arrived.
  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 5000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    void refreshInbox()
  }, [refreshInbox])

  const fitness = inbox?.fitness ?? null
  const style = fitness ? FITNESS_STYLE[fitness.status] : null
  const messages = inbox?.messages ?? []

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
            <p className="max-w-md text-sm text-muted-foreground">
              Send a Medical Report Packet from the Action Center; your flight surgeon answers here.
            </p>
            <ButtonLink to="/actions" variant="outline">
              Open Action Center
            </ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m) =>
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
              ),
            )}
          </ul>
        )}
      </section>
    </div>
  )
}
