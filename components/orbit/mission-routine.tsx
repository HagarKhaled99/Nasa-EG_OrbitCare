'use client'

import Link from 'next/link'
import {
  Bell,
  Bone,
  CalendarCheck,
  Dumbbell,
  Flame,
  HeartPulse,
  Lock,
  Moon,
  Send,
  Shield,
  Stethoscope,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENVIRONMENTS, formatDelay } from '@/lib/orbit/environments'
import { useOrbit } from './orbit-provider'
import { PageHeader } from './page-header'
import { ReadinessRing } from './readiness-ring'

export function MissionRoutine() {
  const { astronaut, readiness, streak, organs, checkedInToday, myVoteFor, reportsSent, env } = useOrbit()
  const answeredPulse = myVoteFor(astronaut.pulseTargetId) !== undefined
  const status = (id: string) => organs.find((o) => o.organ.id === id)?.status

  const routine = [
    { time: '08:00', title: 'Morning vitals', detail: 'Heart rate, blood pressure, temperature, blood sugar', icon: Stethoscope, done: checkedInToday, href: '/check-in' },
    { time: '12:30', title: 'Exercise block', detail: 'Treadmill + resistance device, 150 min total', icon: Dumbbell, done: true, href: '/organ/muscles' },
    { time: '18:00', title: 'Crew Pulse question', detail: 'One private question about a teammate', icon: Users, done: answeredPulse, href: '/crew' },
    { time: '21:00', title: 'Sleep & mood log', detail: 'Wind-down starts, lights dim at 21:30', icon: Moon, done: false, href: '/check-in' },
  ]

  const badges = [
    { title: '7-day streak', detail: 'Checked in 7 days in a row', icon: Flame, unlocked: streak >= 7 },
    { title: 'Crew Guardian', detail: 'Answered today’s Crew Pulse', icon: Shield, unlocked: answeredPulse },
    { title: 'Iron Bones', detail: 'Bones within your normal', icon: Bone, unlocked: status('bones') === 'normal' },
    { title: 'Steady Heart', detail: 'Heart within your normal', icon: HeartPulse, unlocked: status('heart') === 'normal' },
    { title: 'Clear Signal', detail: 'Sent a Medical Report Packet', icon: Send, unlocked: reportsSent > 0 },
    { title: '30-day streak', detail: 'Checked in 30 days in a row', icon: CalendarCheck, unlocked: streak >= 30 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Mission & routine"
        title="Your daily rhythm"
        description="Measurements are part of the mission timeline, so you never have to remember them. Small wins add up to a ready crew."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="routine-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="routine-title" className="flex items-center gap-2 text-lg font-semibold">
            <Bell className="size-4 text-primary" aria-hidden />
            Today&apos;s reminders
          </h2>
          <ol className="relative mt-4 flex flex-col gap-3">
            {routine.map((item) => (
              <li key={item.time}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="w-12 shrink-0 font-mono text-sm font-semibold text-primary">{item.time}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <item.icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block text-sm text-muted-foreground">{item.detail}</span>
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-medium',
                      item.done ? 'bg-status-ok/15 text-status-ok' : 'bg-primary/15 text-primary',
                    )}
                  >
                    {item.done ? 'Done' : 'To do'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="score-title" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="score-title" className="text-lg font-semibold">
            Mission Readiness Score
          </h2>
          <div className="mt-4 flex items-center gap-5">
            <ReadinessRing value={readiness} size={112} />
            <div>
              <p className="flex items-center gap-2 font-mono text-2xl font-semibold">
                <Flame className="size-5 text-status-watch" aria-hidden />
                {streak} days
              </p>
              <p className="text-sm text-muted-foreground">check-in streak</p>
            </div>
          </div>
          <ul className="mt-5 flex flex-col gap-2 text-sm">
            {organs.map((o) => (
              <li key={o.organ.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{o.organ.name}</span>
                <span
                  className={cn(
                    'font-mono',
                    o.status === 'normal' ? 'text-status-ok' : o.status === 'watch' ? 'text-status-watch' : 'text-status-act',
                  )}
                >
                  {o.status === 'normal' ? '0' : o.status === 'watch' ? '−9' : '−22'}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Today&apos;s check-in</span>
              <span className={cn('font-mono', checkedInToday ? 'text-status-ok' : 'text-status-watch')}>
                {checkedInToday ? '0' : '−4'}
              </span>
            </li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="mb-3 text-lg font-semibold">
          Crew badges
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {badges.map((b) => (
            <li
              key={b.title}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center',
                b.unlocked ? 'border-primary/40 bg-primary/10' : 'border-border bg-card opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex size-12 items-center justify-center rounded-full',
                  b.unlocked ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {b.unlocked ? <b.icon className="size-6" aria-hidden /> : <Lock className="size-5" aria-hidden />}
              </span>
              <span className="text-sm font-medium">{b.title}</span>
              <span className="text-xs text-muted-foreground">{b.detail}</span>
              <span className="sr-only">{b.unlocked ? 'Unlocked' : 'Locked'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="env-title" className="rounded-2xl border border-border bg-card p-5">
        <h2 id="env-title" className="text-lg font-semibold">
          Mission environments
        </h2>
        <p className="text-sm text-muted-foreground">
          Each environment changes gravity, radiation rate and communication delay. Every number cites its source.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">Environment</th>
                <th scope="col" className="py-2 pr-4 font-medium">Gravity</th>
                <th scope="col" className="py-2 pr-4 font-medium">Radiation</th>
                <th scope="col" className="py-2 pr-4 font-medium">Earth delay</th>
                <th scope="col" className="py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {ENVIRONMENTS.map((e) => (
                <tr key={e.id} className={cn('border-b border-border/60 last:border-0', e.id === env.id && 'bg-primary/10')}>
                  <th scope="row" className="py-3 pr-4 font-medium">
                    {e.name}
                    {e.id === env.id && <span className="ml-2 text-xs text-primary">current</span>}
                  </th>
                  <td className="py-3 pr-4 font-mono">{e.gravityLabel}</td>
                  <td className="py-3 pr-4 font-mono">{e.radiationPerDay} mSv/day</td>
                  <td className="py-3 pr-4 font-mono">{formatDelay(e.delaySeconds)}</td>
                  <td className="py-3 text-muted-foreground">{e.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
