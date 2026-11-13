import Link from 'next/link'
import { cn } from '@/lib/utils'
import { isUnknown, indicatorShownStatus, ruleSentence, sourceLabel, trendSentence } from '@/lib/orbit/organ-explain'
import type { IndicatorState } from '@/lib/orbit/health'
import { formatValue, styleFor } from '@/lib/orbit/status-style'
import { HowWhyDialog } from './how-why-dialog'
import { StatusPill } from './status-pill'
import { TrendChart } from './trend-chart'

export function IndicatorCard({ indicator }: { indicator: IndicatorState }) {
  const { meta, value, baseline, message, id } = indicator
  const unknown = isUnknown(indicator)
  const status = indicatorShownStatus(indicator)
  const style = styleFor(status)
  const baselineLabel =
    id === 'radiationDose' ? 'Career limit' : id === 'crewPulse' ? 'Expected' : 'Your normal'
  const cleanHistory = indicator.history.filter((p) => Number.isFinite(p.value))

  return (
    <article
      className={cn(
        'rounded-2xl border bg-card p-5',
        unknown ? 'border-dashed border-border' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{meta.label}</h3>
          <p className={cn('mt-0.5 text-sm', status === 'normal' || unknown ? 'text-muted-foreground' : style.text)}>
            {unknown ? 'No reading yet. We do not assume it is normal.' : message}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-secondary/70 p-3">
          <dt className="text-xs text-muted-foreground">Today</dt>
          <dd className={cn('font-mono text-2xl font-semibold', style.text)}>
            {formatValue(value, meta.decimals)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{meta.unit}</span>
          </dd>
        </div>
        <div className="rounded-lg bg-secondary/70 p-3">
          <dt className="text-xs text-muted-foreground">{baselineLabel}</dt>
          <dd className="font-mono text-2xl font-semibold">
            {formatValue(baseline, meta.decimals)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{meta.unit}</span>
          </dd>
        </div>
        <div className="col-span-2 flex flex-col justify-end gap-1 rounded-lg p-3 sm:col-span-1">
          <HowWhyDialog id={id} label="How & why" />
        </div>
      </dl>

      {id !== 'crewPulse' && (
        <div className="mt-4">
          <p className="mb-1 text-xs text-muted-foreground">Last 30 mission days</p>
          {cleanHistory.length >= 2 ? (
            <>
              <TrendChart indicator={{ ...indicator, history: cleanHistory }} />
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{trendSentence(indicator)}</p>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No graph yet. Save a reading in{' '}
              <Link href="/check-in" className="font-medium text-primary underline-offset-4 hover:underline">
                Daily Check-in
              </Link>{' '}
              to start one.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-0.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Rule:</span> {ruleSentence(meta)} Demo threshold, not clinical.
        </p>
        <p>
          <span className="font-medium text-foreground">Data:</span> {sourceLabel(id)}.{' '}
          <span className="font-medium text-foreground">Reference:</span> {meta.source}.
        </p>
      </div>
    </article>
  )
}
