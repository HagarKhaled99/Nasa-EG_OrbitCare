'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, Delete, IdCard, Watch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CREW, getAstronaut } from '@/lib/orbit/crew'
import { AuthSplit } from './auth-split'
import { useOrbit } from './orbit-provider'

const PIN_LENGTH = 4
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const

export function SignIn() {
  const router = useRouter()
  const { astronaut: active, setAstronautId } = useOrbit()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState('')

  const selected = selectedId ? getAstronaut(selectedId) : null
  const firstName = selected?.name.split(' ')[0]

  const choose = (id: string) => {
    setSelectedId(id)
    setPin('')
  }

  const press = (key: (typeof KEYS)[number]) => {
    if (!selected) return
    if (key === 'clear') return setPin('')
    if (key === 'back') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, PIN_LENGTH)
    setPin(next)
    if (next.length === PIN_LENGTH) {
      setAstronautId(selected.id)
      router.push('/')
    }
  }

  return (
    <AuthSplit figure={selected?.figure ?? 'female'}>
      {!selected ? (
        <section aria-labelledby="signin-title" className="flex flex-col gap-6">
          <div>
            <p className="font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
              Sign in · 20:52 ship time
            </p>
            <h1 id="signin-title" className="mt-1 text-3xl font-semibold text-balance">
              Who&apos;s checking in?
            </h1>
            <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
              Each twin knows one person&apos;s normal. Choose your profile, then enter your PIN.
            </p>
          </div>

          <ul className="flex flex-col gap-3">
            {CREW.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => choose(member.id)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-sm font-semibold text-primary">
                    {member.initials}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{member.name}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {member.role} · last check-in {member.lastCheckIn}
                    </span>
                  </span>
                  <span className="hidden items-center gap-1 rounded-full border border-status-ok/40 bg-status-ok/10 px-2 py-0.5 text-xs font-medium text-status-ok sm:inline-flex">
                    <Watch className="size-3" aria-hidden />
                    Watch synced
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="lg" className="h-11 px-4" onClick={() => choose(active.id)}>
              <IdCard aria-hidden />
              Tap crew badge instead
            </Button>
            <Button variant="ghost" size="lg" className="h-11 px-4" nativeButton={false} render={<Link href="/signup" />}>
              New crew member? Create a profile
            </Button>
          </div>

          <p className="rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
            Works fully offline. All data stays on this tablet; a daily summary is queued for flight surgeons.
          </p>
        </section>
      ) : (
        <section aria-labelledby="pin-title" className="flex flex-col items-center gap-6 text-center">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Not {firstName}? Switch
          </button>
          <span className="flex size-20 items-center justify-center rounded-full bg-primary/15 font-mono text-2xl font-semibold text-primary">
            {selected.initials}
          </span>
          <div>
            <h1 id="pin-title" className="text-3xl font-semibold">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-muted-foreground">Enter your 4-digit PIN</p>
          </div>

          <div className="flex gap-4" role="status" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'size-4 rounded-full border-2 border-primary transition-colors',
                  i < pin.length ? 'bg-primary' : 'bg-transparent',
                )}
                aria-hidden
              />
            ))}
          </div>

          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear PIN' : key}
                className={cn(
                  'flex h-16 items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-primary/15',
                  key === 'clear' || key === 'back'
                    ? 'text-sm font-medium text-muted-foreground'
                    : 'font-mono text-2xl font-semibold',
                )}
              >
                {key === 'back' ? <Delete className="size-5" aria-hidden /> : key === 'clear' ? 'Clear' : key}
              </button>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Locked after 5 wrong tries. Your crew medical officer can reset it.
          </p>
        </section>
      )}
    </AuthSplit>
  )
}
