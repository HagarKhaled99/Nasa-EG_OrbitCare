import { Activity, Gauge, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrganAnswers } from '@/lib/orbit/organ-explain'
import { styleFor } from '@/lib/orbit/status-style'
import { StatusPill } from './status-pill'

function AnswerCard({
  icon: Icon,
  question,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  question: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <article className={cn('flex flex-col gap-2 rounded-2xl border border-border bg-card p-5', className)}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" aria-hidden />
        {question}
      </h2>
      {children}
    </article>
  )
}

/** Answers 1–3 of the four plain-English answers. Answer 4 (what to do) sits next to the readings. */
export function OrganAnswersRow({ answers }: { answers: OrganAnswers }) {
  const { changed, why, serious } = answers
  const seriousStyle = styleFor(serious.status)

  return (
    <section aria-label="Plain-English summary" className="grid gap-4 md:grid-cols-3">
      <AnswerCard icon={Activity} question="What changed?">
        <p className="text-sm font-medium">{changed.headline}</p>
        {changed.lines.length > 0 && (
          <ul className="mt-1 flex flex-col gap-2">
            {changed.lines.map((line) => (
              <li key={line.label} className="text-sm leading-relaxed">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', styleFor(line.status).bg)} />
                  <span className="font-medium">{line.label}</span>
                </span>
                <span className="ml-3.5 block text-muted-foreground">{line.text}</span>
              </li>
            ))}
          </ul>
        )}
      </AnswerCard>

      <AnswerCard icon={Lightbulb} question="Why does it matter?">
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{why.text}</p>
        <p className="mt-auto pt-1 text-xs text-muted-foreground">About: {why.about}</p>
      </AnswerCard>

      <AnswerCard
        icon={Gauge}
        question="How serious is it?"
        className={cn(seriousStyle.border, seriousStyle.soft)}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={serious.status} />
          <span className={cn('text-sm font-semibold', seriousStyle.text)}>{serious.headline}</span>
        </div>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{serious.detail}</p>
      </AnswerCard>
    </section>
  )
}
