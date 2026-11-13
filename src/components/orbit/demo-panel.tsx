/**
 * Judge-demo controls (plan §11). A small, clearly labelled panel so the pitch can show the twin reacting live:
 * the watch sends a worsening reading, an emergency is injected, and a rehearsal can be reset.
 * Every injected value is stored as a SIMULATED_WATCH reading marked "DEMO INJECTION".
 */
import { useState } from 'react'
import { Activity, FlaskConical, Loader2, RotateCcw, Siren, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOrbit } from './orbit-provider'

type Action = 'worsening' | 'emergency' | 'reset'

const RESULT: Record<Action, string> = {
  worsening: 'Sent. Heart rate up and sleep down: watch your heart and brain change on the Twin View.',
  emergency: 'Injected: SpO₂ below 90 % with a good signal. The emergency alert opens.',
  reset: 'Your check-ins and injected readings were removed. The demo data is back to its start.',
}

export function DemoPanel() {
  const { demo, astronaut } = useOrbit()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const run = async (action: Action) => {
    setBusy(action)
    setMessage(null)
    const ok =
      action === 'worsening'
        ? await demo.sendWorseningReading()
        : action === 'emergency'
          ? await demo.injectEmergency()
          : await demo.reset()
    setBusy(null)
    setMessage(ok ? RESULT[action] : 'The crew server is not reachable. Start the app with “npm run dev”.')
  }

  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2 lg:bottom-6">
      {open && (
        <section
          aria-labelledby="demo-title"
          className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-dashed border-primary/60 bg-card p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="demo-title" className="flex items-center gap-2 font-semibold">
                <FlaskConical className="size-4 text-primary" aria-hidden />
                Judge demo controls
              </h2>
              <p className="text-xs text-muted-foreground">
                Synthetic data for {astronaut.name.split(' ')[0]}. Not part of the astronaut&apos;s daily use.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo controls"
              className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <DemoButton icon={Activity} busy={busy === 'worsening'} onClick={() => void run('worsening')}>
              Watch sends a worsening reading
            </DemoButton>
            <DemoButton icon={Siren} busy={busy === 'emergency'} onClick={() => void run('emergency')} danger>
              Inject emergency (low SpO₂)
            </DemoButton>
            <DemoButton icon={RotateCcw} busy={busy === 'reset'} onClick={() => void run('reset')}>
              Reset my demo data
            </DemoButton>
          </div>
          {message && (
            <p role="status" className="mt-3 rounded-lg bg-secondary p-2 text-xs leading-relaxed">
              {message}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Also for the demo: change the environment in the top bar (ISS ↔ Mars), the blackout button on the Twin View,
            and the Future Slider.
          </p>
        </section>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-dashed border-primary/60 bg-card px-4 py-2 font-mono text-xs font-semibold tracking-wider text-primary uppercase shadow-lg hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <FlaskConical className="size-4" aria-hidden />
        Demo
      </button>
    </div>
  )
}

function DemoButton({
  icon: Icon,
  busy,
  danger,
  onClick,
  children,
}: {
  icon: typeof Activity
  busy: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className={cn('h-10 justify-start', danger && 'border-status-act/50 text-status-act hover:bg-status-act/10 hover:text-status-act')}
    >
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
      {children}
    </Button>
  )
}
