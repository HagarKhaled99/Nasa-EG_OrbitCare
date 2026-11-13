import { ChevronDown, ExternalLink, Library } from 'lucide-react'
import { DISTANCE_HAZARD, ORGAN_SOURCES, type SourceLink } from '@/lib/orbit/sources'
import type { OrganId } from '@/lib/orbit/organs'

function SourceRow({ source }: { source: SourceLink }) {
  return (
    <li className="flex flex-col gap-0.5">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {source.title}
        <ExternalLink className="size-3.5" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <p className="text-sm leading-relaxed text-muted-foreground">{source.summary}</p>
    </li>
  )
}

/** Collapsed by default so it does not crowd the page, but the sources stay one tap away. */
export function OrganSources({ id }: { id: OrganId }) {
  const { hazard, risks, note } = ORGAN_SOURCES[id]
  const count = risks.length + 2

  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <Library className="size-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Where this comes from</span>
          <span className="block text-xs text-muted-foreground">
            {count} NASA / CSA sources. Thresholds and protocol steps are demo values.
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="border-t border-border p-4 pt-4">
        <ul className="grid gap-4 md:grid-cols-2">
          <SourceRow source={hazard} />
          <SourceRow source={DISTANCE_HAZARD} />
          {risks.map((risk) => (
            <SourceRow key={risk.url} source={risk} />
          ))}
        </ul>
        {note && <p className="mt-4 rounded-lg bg-secondary p-3 text-sm">{note}</p>}
      </div>
    </details>
  )
}
