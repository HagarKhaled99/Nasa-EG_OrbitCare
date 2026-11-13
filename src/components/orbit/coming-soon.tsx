import { ArrowLeft, Compass } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ButtonLink } from '@/components/ui/button'

/** Shown for addresses that do not match any page. Every screen in the menu is built. */
export function ComingSoon() {
  const { pathname } = useLocation()
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Compass className="size-6" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        There is no page at <span className="font-mono">{pathname}</span>. Use the menu to open a screen.
      </p>
      <ButtonLink to="/" variant="outline">
        <ArrowLeft aria-hidden />
        Back to Twin View
      </ButtonLink>
    </section>
  )
}
