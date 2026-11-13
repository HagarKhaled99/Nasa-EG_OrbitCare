import { Link } from 'react-router-dom'
import {
  Bell, Bone, CalendarCheck, Dumbbell, Flame, HeartPulse,
  Lock, Moon, Send, Shield, Stethoscope, Users,
} from 'lucide-react'
import { useOrbit } from './orbit-provider'
import { ENVIRONMENTS, formatDelay } from '@/lib/orbit/environments'
import { cn } from '@/lib/utils'

function LocalReadinessRing({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(100, value))
  const circumference = 2 * Math.PI * 43
  return (
    <div className="relative size-28 shrink-0">
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r="43" fill="none" stroke="currentColor" strokeOpacity=".12" strokeWidth="9" />
        <circle cx="50" cy="50" r="43" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${circumference * safeValue / 100} ${circumference}`} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold">{Math.round(safeValue)}%</span>
    </div>
  )
}

export function MissionRoutine() {
  const { astronaut, readiness, streak, organs, checkedInToday, myVoteFor, reportsSent, env } = useOrbit()
  const answeredPulse = myVoteFor(astronaut.pulseTargetId) !== undefined
  const organStatus = (id: string) => organs.find((item) => item.organ.id === id)?.status

  const routine = [
    { time: '08:00', title: 'Morning vitals', detail: 'Heart rate, blood pressure, temperature and blood sugar', icon: Stethoscope, done: checkedInToday, href: '/check-in' },
    { time: '12:30', title: 'Exercise block', detail: 'Treadmill and resistance training', icon: Dumbbell, done: true, href: '/organ/muscles' },
    { time: '18:00', title: 'Crew Pulse question', detail: 'Private daily question about a teammate', icon: Users, done: answeredPulse, href: '/crew' },
    { time: '21:00', title: 'Sleep & mood log', detail: 'Wind-down routine and sleep preparation', icon: Moon, done: false, href: '/check-in' },
  ]

  const badges = [
    { title: '7-day streak', detail: 'Checked in 7 days in a row', icon: Flame, unlocked: streak >= 7 },
    { title: 'Crew Guardian', detail: 'Answered today’s Crew Pulse', icon: Shield, unlocked: answeredPulse },
    { title: 'Iron Bones', detail: 'Bones within normal status', icon: Bone, unlocked: organStatus('bones') === 'normal' },
    { title: 'Steady Heart', detail: 'Heart within normal status', icon: HeartPulse, unlocked: organStatus('heart') === 'normal' },
    { title: 'Clear Signal', detail: 'Sent a Medical Report Packet', icon: Send, unlocked: reportsSent > 0 },
    { title: '30-day streak', detail: 'Checked in 30 days in a row', icon: CalendarCheck, unlocked: streak >= 30 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Mission & routine</p>
        <h1 className="mt-2 text-3xl font-semibold">Your daily rhythm</h1>
        <p className="mt-2 text-sm text-muted-foreground">Daily reminders, mission readiness and crew achievements.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-5 text-primary" />Today’s reminders</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {routine.map((item) => (
              <li key={item.time}>
                <Link to={item.href} className="flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-secondary">
                  <span className="w-12 shrink-0 font-mono text-sm text-primary">{item.time}</span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary"><item.icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.title}</span>
                    <span className="block text-xs text-muted-foreground">{item.detail}</span>
                  </span>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', item.done ? 'bg-status-ok/15 text-status-ok' : 'bg-primary/15 text-primary')}>{item.done ? 'Done' : 'To do'}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Mission Readiness Score</h2>
          <div className="mt-4 flex items-center gap-4">
            <LocalReadinessRing value={readiness} />
            <div>
              <p className="flex items-center gap-2 font-mono text-2xl font-semibold"><Flame className="size-5 text-status-watch" />{streak} days</p>
              <p className="text-sm text-muted-foreground">Check-in streak</p>
            </div>
          </div>
          <ul className="mt-5 flex flex-col gap-2 text-sm">
            {organs.map((item) => (
              <li key={item.organ.id} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{item.organ.name}</span>
                <span className={cn('font-mono', item.status === 'normal' ? 'text-status-ok' : item.status === 'watch' ? 'text-status-watch' : 'text-status-act')}>
                  {item.status === 'normal' ? '0' : item.status === 'watch' ? '−9' : '−22'}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Today’s check-in</span>
              <span className={cn('font-mono', checkedInToday ? 'text-status-ok' : 'text-status-watch')}>{checkedInToday ? '0' : '−4'}</span>
            </li>
          </ul>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Crew badges</h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {badges.map((badge) => (
            <li key={badge.title} className={cn('flex flex-col items-center gap-2 rounded-2xl border p-4 text-center', badge.unlocked ? 'border-primary/40 bg-primary/10' : 'border-border bg-card opacity-60')}>
              <span className={cn('flex size-12 items-center justify-center rounded-full', badge.unlocked ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground')}>
                {badge.unlocked ? <badge.icon className="size-6" /> : <Lock className="size-5" />}
              </span>
              <span className="text-sm font-medium">{badge.title}</span>
              <span className="text-xs text-muted-foreground">{badge.detail}</span>
              <span className="sr-only">{badge.unlocked ? 'Unlocked' : 'Locked'}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Mission environments</h2>
        <p className="text-sm text-muted-foreground">Environment conditions, radiation and communication delay.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead><tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-4">Environment</th><th className="py-2 pr-4">Gravity</th><th className="py-2 pr-4">Radiation</th><th className="py-2 pr-4">Earth delay</th><th className="py-2">Source</th>
            </tr></thead>
            <tbody>
              {ENVIRONMENTS.map((item) => (
                <tr key={item.id} className={cn('border-b border-border/60 last:border-0', item.id === env.id && 'bg-primary/10')}>
                  <th className="py-3 pr-4 font-medium">{item.name}{item.id === env.id && <span className="ml-2 text-xs text-primary">current</span>}</th>
                  <td className="py-3 pr-4 font-mono">{item.gravityLabel}</td>
                  <td className="py-3 pr-4 font-mono">{item.radiationPerDay} mSv/day</td>
                  <td className="py-3 pr-4 font-mono">{formatDelay(item.delaySeconds)}</td>
                  <td className="py-3 text-muted-foreground">{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
