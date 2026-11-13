'use client'

import { BookOpen, HelpCircle, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { INDICATORS, type IndicatorId } from '@/lib/orbit/indicators'

export function HowWhyDialog({ id, label = 'How do I measure this?' }: { id: IndicatorId; label?: string }) {
  const meta = INDICATORS[id]
  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1 rounded-md text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <HelpCircle className="size-3.5" aria-hidden />
        {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meta.label}</DialogTitle>
          <DialogDescription>How &amp; Why card</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <section>
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <BookOpen className="size-4 text-primary" aria-hidden />
              How to measure
            </h3>
            <p className="text-muted-foreground">{meta.how}</p>
          </section>
          <section>
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <HelpCircle className="size-4 text-primary" aria-hidden />
              Why it matters in space
            </h3>
            <p className="text-muted-foreground">{meta.why}</p>
          </section>
          <section className="rounded-lg border border-border bg-secondary/60 p-3">
            <h3 className="mb-1 flex items-center gap-2 font-semibold">
              <ShieldAlert className="size-4 text-status-watch" aria-hidden />
              Space hazard: {meta.hazard}
            </h3>
            <p className="text-xs text-muted-foreground">Source: {meta.source}</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
