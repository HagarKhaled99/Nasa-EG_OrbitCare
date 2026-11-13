import { ArrowLeft, Construction } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/button'
import { getOrgan } from '@/lib/orbit/organs'

const TITLES: Record<string, string> = {
  '/check-in': 'Daily Check-in',
  '/future': 'Future Slider',
  '/actions': 'Action Center',
  '/crew': 'Crew Pulse',
  '/mission': 'Mission & Routine',
  '/login': 'Sign in',
}

/** Placeholder for screens that are not ported yet. Only Twin View (home) is implemented. */
export function ComingSoon() {
  const { pathname } = useLocation()
  const organ = pathname.startsWith('/organ/') ? getOrgan(pathname.split('/')[2]) : undefined
  const title = organ ? `${organ.name} panel` : (TITLES[pathname] ?? 'Page not found')

  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Construction className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        This screen is coming next. Twin View is the only screen built so far.
      </p>
      <ButtonLink to="/" variant="outline">
        <ArrowLeft aria-hidden />
        Back to Twin View
      </ButtonLink>
    </section>
  )
}
