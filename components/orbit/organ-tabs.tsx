'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { organShownStatus } from '@/lib/orbit/organ-explain'
import { styleFor } from '@/lib/orbit/status-style'
import { useOrbit } from './orbit-provider'

/** Shared strip on all seven /organ/... routes so you can hop between systems. */
export function OrganTabs() {
  const pathname = usePathname()
  const { organs } = useOrbit()

  return (
    <nav
      aria-label="Body systems"
      className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8"
    >
      <ul className="flex w-max gap-2">
        {organs.map((state) => {
          const href = `/organ/${state.organ.id}`
          const active = pathname === href
          const status = organShownStatus(state)
          const style = styleFor(status)
          return (
            <li key={state.organ.id}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <span
                  aria-hidden
                  className={cn('size-2 rounded-full ring-2', style.bg, active ? 'ring-primary-foreground/60' : 'ring-card')}
                />
                {state.organ.shortName}
                <span className="sr-only">, status {style.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
