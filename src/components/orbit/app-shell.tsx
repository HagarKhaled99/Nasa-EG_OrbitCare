import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Hourglass,
  LogOut,
  Orbit,
  PersonStanding,
  Rocket,
  Siren,
  Users,
  Mail,
  Watch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { WATCH_SYNC } from '@/lib/orbit/sensors'
import { useOrbit } from './orbit-provider'
import { TopBar } from './top-bar'
import { DemoPanel } from './demo-panel'
import { EmergencyOverlay } from './emergency-overlay'

const NAV = [
  { href: '/', label: 'Twin View', short: 'Twin', icon: PersonStanding },
  { href: '/check-in', label: 'Daily Check-in', short: 'Check-in', icon: ClipboardCheck },
  { href: '/future', label: 'Future Slider', short: 'Future', icon: Hourglass },
  { href: '/actions', label: 'Action Center', short: 'Actions', icon: Siren },
  { href: '/crew', label: 'Crew Pulse', short: 'Crew', icon: Users },
  { href: '/inbox', label: 'Inbox from Earth', short: 'Inbox', icon: Mail },
  { href: '/mission', label: 'Mission & Routine', short: 'Mission', icon: Rocket },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/' || pathname.startsWith('/organ')
  return pathname.startsWith(href)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { alerts, checkedInToday, signOut, watch, unreadAdvice } = useOrbit()
  const urgent = alerts.some((a) => a.status === 'act')

  const badgeFor = (href: string) => {
    if (href === '/actions' && alerts.length > 0) return String(alerts.length)
    if (href === '/check-in' && !checkedInToday) return 'Due'
    if (href === '/inbox' && unreadAdvice > 0) return String(unreadAdvice)
    return null
  }

  // Auth pages and the Ground portal (its own layout) render without the astronaut shell.
  if (pathname === '/login' || pathname === '/signup' || pathname === '/manage-crew' || pathname === '/validation' || pathname.startsWith('/ground')) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link to="/" className="flex items-center gap-3 px-6 py-6">
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
                to={item.href}
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
            {watch.paused ? 'Watch stream paused' : watch.stale ? 'Watch: no good reading' : 'Watch live'}
            <span
              aria-hidden
              className={cn(
                'ml-auto size-2 rounded-full',
                watch.paused ? 'bg-muted-foreground' : watch.stale ? 'bg-status-watch' : 'bg-status-ok animate-pulse',
              )}
            />
          </p>
          <p className="mt-1">
            Battery {WATCH_SYNC.battery}%. Works without internet: data stays in the crew database on board, reports are
            queued for the next comms window.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => navigate('/login'))
          }}
          className="m-3 mt-2 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <LogOut className="size-5" aria-hidden />
          Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 px-4 pt-4 pb-28 md:px-6 lg:px-8 lg:pb-10">{children}</main>
        <EmergencyOverlay />
        <DemoPanel />
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-border bg-sidebar/95 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const badge = badgeFor(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
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
  )
}
