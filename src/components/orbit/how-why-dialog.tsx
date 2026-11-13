/**
 * "How & Why" card for one measurement (Member 4's design). Uses the browser's built-in <dialog>
 * (focus trap, Esc to close, backdrop) instead of the @base-ui dialog the Next.js project used.
 */
import { useRef } from 'react'
import { BookOpen, HelpCircle, ShieldAlert, X } from 'lucide-react'
import { INDICATORS, type IndicatorId } from '@/lib/orbit/indicators'

export function HowWhyDialog({ id, label = 'How do I measure this?' }: { id: IndicatorId; label?: string }) {
  const meta = INDICATORS[id]
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = `howwhy-${id}`

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <HelpCircle className="size-3.5" aria-hidden />
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        // Click on the backdrop (outside the card) closes it.
        onClick={(e) => {
          if (e.target === ref.current) ref.current.close()
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">
                {meta.label}
              </h2>
              <p className="text-sm text-muted-foreground">How &amp; Why card</p>
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
          <section className="text-sm leading-relaxed">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <BookOpen className="size-4 text-primary" aria-hidden />
              How to measure
            </h3>
            <p className="text-muted-foreground">{meta.how}</p>
          </section>
          <section className="text-sm leading-relaxed">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <HelpCircle className="size-4 text-primary" aria-hidden />
              Why it matters in space
            </h3>
            <p className="text-muted-foreground">{meta.why}</p>
          </section>
          <section className="rounded-lg border border-border bg-secondary/60 p-3 text-sm">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 text-status-watch" aria-hidden />
              Space hazard: {meta.hazard}
            </h3>
            <p className="text-xs text-muted-foreground">Source: {meta.source}</p>
          </section>
        </div>
      </dialog>
    </>
  )
}
