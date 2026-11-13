'use client'

import Link from 'next/link'
import { CheckCircle2, EyeOff, HeartHandshake, MessageCircleQuestion, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CREW, getAstronaut } from '@/lib/orbit/crew'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'
import { StatusPill } from './status-pill'

const REFLEXIVE: Record<string, string> = {
  sara: 'herself',
  ahmed: 'himself',
  lena: 'herself',
  omar: 'himself',
}

export function CrewPulse() {
  const { astronaut, indicators, organs, votes, castVote, myVoteFor } = useOrbit()
  const target = getAstronaut(astronaut.pulseTargetId)
  const myVote = myVoteFor(target.id)
  const flags = votes.filter((v) => !v.seemsLikeThemselves).length
  const brain = organs.find((o) => o.organ.id === 'brain')
  const selfMood = indicators.mood.value
  const mismatch = flags >= 2 && selfMood >= 4

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Crew Pulse · Behavioral health"
        title="Look out for each other"
        description="People in isolation are poor at noticing their own mood decline. One private question a day lets the crew catch what the mirror misses."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="question-title" className="flex flex-col rounded-2xl border border-primary/30 bg-card p-6">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <MessageCircleQuestion className="size-4" aria-hidden />
            Today&apos;s question
          </p>
          <div className="mt-4 flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-secondary font-mono text-lg font-semibold">
              {target.initials}
            </span>
            <h2 id="question-title" className="text-2xl font-semibold text-balance">
              Does {target.name.split(' ')[0]} seem like {REFLEXIVE[target.id]} today?
            </h2>
          </div>
          {myVote === undefined ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base"
                onClick={() => castVote(target.id, true)}
              >
                <ThumbsUp aria-hidden />
                Yes, seems fine
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-14 text-base"
                onClick={() => castVote(target.id, false)}
              >
                <ThumbsDown aria-hidden />
                Not quite
              </Button>
            </div>
          ) : (
            <div aria-live="polite" className="mt-6 flex items-start gap-3 rounded-xl border border-status-ok/40 bg-status-ok/10 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-status-ok" aria-hidden />
              <div>
                <p className="font-medium">Thank you. Your answer is private.</p>
                <p className="mt-1 text-muted-foreground">
                  {myVote
                    ? 'Nothing else to do.'
                    : `Consider inviting ${target.name.split(' ')[0]} for a meal or a window break today. The medical officer only sees combined counts.`}
                </p>
                <button
                  type="button"
                  onClick={() => castVote(target.id, !myVote)}
                  className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Change answer
                </button>
              </div>
            </div>
          )}
          <p className="mt-auto flex items-center gap-2 pt-6 text-xs text-muted-foreground">
            <EyeOff className="size-4" aria-hidden />
            Answers are anonymous. Crewmates never see who flagged whom.
          </p>
        </section>

        <section aria-labelledby="mypulse-title" className={cn('rounded-2xl border bg-card p-6', brain && STATUS_STYLE[brain.status].border)}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="mypulse-title" className="text-lg font-semibold">
              Your pulse today
            </h2>
            {brain && <StatusPill status={brain.status} size="lg" />}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-secondary/70 p-4">
              <dt className="text-xs text-muted-foreground">You said</dt>
              <dd className="mt-1 font-mono text-3xl font-semibold">
                {selfMood}
                <span className="text-sm font-normal text-muted-foreground"> / 5</span>
              </dd>
              <dd className="text-sm text-muted-foreground">{selfMood >= 4 ? 'Feeling fine' : 'Not great'}</dd>
            </div>
            <div className="rounded-xl bg-secondary/70 p-4">
              <dt className="text-xs text-muted-foreground">Your crew said</dt>
              <dd className={cn('mt-1 font-mono text-3xl font-semibold', STATUS_STYLE[indicators.crewPulse.status].text)}>
                {flags}
                <span className="text-sm font-normal text-muted-foreground"> / {votes.length}</span>
              </dd>
              <dd className="text-sm text-muted-foreground">noticed a change</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed">{indicators.crewPulse.message}</p>
          {mismatch && (
            <div className="mt-4 rounded-xl border border-status-watch/40 bg-status-watch/10 p-4 text-sm leading-relaxed">
              <p className="flex items-center gap-2 font-medium text-status-watch">
                <HeartHandshake className="size-4" aria-hidden />
                Your crew sees something you might not
              </p>
              <p className="mt-1 text-muted-foreground">
                This is common on long missions and nothing to be ashamed of. Your brain twin has turned yellow so
                you get the sleep and stress protocol.
              </p>
              <Button className="mt-3" nativeButton={false} render={<Link href="/organ/brain" />}>
                Open sleep &amp; stress plan
              </Button>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="crew-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="crew-title" className="text-lg font-semibold">
          Crew participation
        </h2>
        <p className="text-sm text-muted-foreground">You only see who has taken part — never anyone&apos;s health data.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {CREW.map((member) => {
            const isMe = member.id === astronaut.id
            const answered = isMe ? myVote !== undefined : true
            return (
              <li key={member.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary font-mono text-sm font-semibold">
                  {member.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {member.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.role}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    answered ? 'bg-status-ok/15 text-status-ok' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  {answered ? 'Answered' : 'Pending'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
