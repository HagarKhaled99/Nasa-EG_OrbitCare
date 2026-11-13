'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardCheck,
  Hourglass,
  LogOut,
  Orbit,
  PersonStanding,
  Rocket,
  Siren,
  Users,
  Watch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WATCH_SYNC } from '@/lib/orbit/sensors'
import { useOrbit } from './orbit-provider'
import { SessionGate } from './session-gate'
import { TopBar } from './top-bar'

const NAV = [
  { href: '/', label: 'Twin View', short: 'Twin', icon: PersonStanding },
  { href: '/check-in', label: 'Daily Check-in', short: 'Check-in', icon: ClipboardCheck },
  { href: '/future', label: 'Future Slider', short: 'Future', icon: Hourglass },
  { href: '/actions', label: 'Action Center', short: 'Actions', icon: Siren },
  { href: '/crew', label: 'Crew Pulse', short: 'Crew', icon: Users },
  { href: '/mission', label: 'Mission & Routine', short: 'Mission', icon: Rocket },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/organ')
  return pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { alerts, checkedInToday } = useOrbit()
  const urgent = alerts.some((a) => a.status === 'act')

  const badgeFor = (href: string) => {
    if (href === '/actions' && alerts.length > 0) return String(alerts.length)
    if (href === '/check-in' && !checkedInToday) return 'Due'
    return null
  }

  if (pathname === '/login' || pathname === '/signup') return <SessionGate>{children}</SessionGate>

  return (
    <SessionGate>
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link href="/" className="flex items-center gap-3 px-6 py-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Orbit className="size-5" aria-hidden />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-mono text-sm font-semibold tracking-[0.2em]">ORBIT TWIN</span>
            <span className="text-xs text-muted-foreground">Your health twin</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href)
            const badge = badgeFor(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                  active && 'bg-sidebar-accent text-foreground',
                )}
              >
                <item.icon className={cn('size-5', active && 'text-primary')} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold',
                      item.href === '/actions'
                        ? urgent
                          ? 'bg-status-act text-background'
                          : 'bg-status-watch text-background'
                        : 'bg-primary/15 text-primary',
                    )}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="mx-3 mt-3 rounded-xl border border-sidebar-border bg-background/40 p-4 text-xs leading-relaxed text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Watch className="size-4 text-primary" aria-hidden />
            Watch synced {WATCH_SYNC.lastSync}
          </p>
          <p className="mt-1">
            Battery {WATCH_SYNC.battery}%. Works offline: all data stays on this tablet, reports are queued for the
            next comms window.
          </p>
        </div>
        <Link
          href="/login"
          className="m-3 mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <LogOut className="size-5" aria-hidden />
          Sign out
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 pt-4 pb-28 md:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-sidebar/95 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const badge = badgeFor(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium text-muted-foreground',
                active && 'text-primary',
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.short}
              {badge && (
                <span
                  className={cn(
                    'absolute top-1 right-[calc(50%-1.25rem)] size-2 rounded-full',
                    item.href === '/actions' && urgent ? 'bg-status-act' : 'bg-status-watch',
                  )}
                  aria-label={item.href === '/actions' ? `${badge} alerts` : 'Check-in due'}
                />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
    </SessionGate>
  )
}
