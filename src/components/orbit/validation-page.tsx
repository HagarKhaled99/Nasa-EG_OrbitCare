/**
 * /validation: "Do the alerts come at the right time?"
 * Runs the real twin rules on 1,000 simulated astronauts in the browser (memory only: nothing is saved, nobody is
 * added to the sign-in list or the crew database). Public, so judges can open it without a PIN.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PROBLEMS,
  RULE_LABEL,
  runValidation,
  type ValidationResult,
  type WatchRule,
} from '@/lib/orbit/validation'

const RULES: WatchRule[] = ['single-day', 'confirm-all', 'app']
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
const perMonth = (v: number) => v.toFixed(v < 1 ? 2 : 1)
const days = (v: number | null) => (v === null ? '—' : `${v} day${v === 1 ? '' : 's'}`)
const nextFrame = () => new Promise((resolve) => window.setTimeout(resolve, 30))

export function ValidationPage() {
  const [seed, setSeed] = useState(2026)
  const [results, setResults] = useState<Partial<Record<WatchRule, ValidationResult>>>({})
  const [running, setRunning] = useState<WatchRule | null>(null)

  const run = useCallback(async (s: number) => {
    setResults({})
    // Our rule first (that is the headline), then the two rules we compared it with. One at a time so the page stays responsive.
    for (const rule of ['app', 'single-day', 'confirm-all'] as WatchRule[]) {
      setRunning(rule)
      await nextFrame()
      const r = runValidation({ seed: s, rule })
      setResults((prev) => ({ ...prev, [rule]: r }))
    }
    setRunning(null)
  }, [])

  useEffect(() => {
    void run(2026)
  }, [run])

  const r = results.app
  const again = () => {
    const s = Math.floor(Math.random() * 1_000_000)
    setSeed(s)
    void run(s)
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
      <Link
        to="/login"
        className="inline-flex items-center gap-1 self-start rounded-md text-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to sign in
      </Link>

      <header>
        <p className="flex items-center gap-2 font-mono text-xs font-medium tracking-[0.2em] text-primary uppercase">
          <FlaskConical className="size-3.5" aria-hidden />
          Validation
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-balance sm:text-4xl">Do the alerts come at the right time?</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-pretty text-muted-foreground">
          An alert that fires too often gets ignored. An alert that fires too late is useless. We tested our rules the way a
          smoke alarm is tested: on many made-up cases before trusting it with real people.
        </p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ['1', 'Create 1,000 simulated astronauts', 'Each one has their own normal and normal day-to-day ups and downs, plus 5% of days with no watch signal.'],
          ['2', 'Hide a slowly worsening problem in about 40%', 'Rising heart rate, falling oxygen, sleep loss, fever or rising blood pressure, starting on a random day.'],
          ['3', 'Run the same twin rules the app uses, day by day', 'Did it warn before the problem became serious? How many days ahead? How many false alarms for healthy people?'],
        ].map(([n, title, body]) => (
          <li key={n} className="rounded-2xl border border-border bg-card p-4">
            <p className="font-mono text-xs text-primary">STEP {n}</p>
            <p className="mt-1 font-medium">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </li>
        ))}
      </ol>

      <section aria-labelledby="results-title" aria-busy={running !== null} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-title" className="text-xl font-semibold">
              Results with our rule
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Seed {seed} · 60 mission days each · runs in your browser, nothing is saved
              {r ? ` · ${r.millis} ms` : ''}
            </p>
          </div>
          <Button type="button" variant="outline" className="h-9" onClick={again} disabled={running !== null}>
            {running ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {running ? 'Running…' : 'Run again with new astronauts'}
          </Button>
        </div>

        {!r ? (
          <p role="status" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Simulating 1,000 astronauts…
          </p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Caught before serious"
                value={pct(r.caughtEarly, r.withProblem)}
                note={`${r.caughtEarly} of ${r.withProblem} hidden problems`}
                tone="ok"
              />
              <Stat label="Missed completely" value={String(r.missed)} note="never warned at all" tone={r.missed ? 'act' : 'ok'} />
              <Stat label="Warning ahead (median)" value={days(r.medianLeadDays)} note="before it became serious" />
              <Stat
                label="Missing data shown Unknown"
                value={pct(r.missingShownUnknown * r.missingDays, r.missingDays)}
                note={`${r.missingDays.toLocaleString()} missing readings, none called normal`}
                tone="ok"
              />
              <Stat
                label="False Watch, healthy astronaut"
                value={perMonth(r.falseWatchPer30)}
                note="days per month (yellow, “keep an eye on it”)"
                tone="watch"
              />
              <Stat
                label="False Act, healthy astronaut"
                value={perMonth(r.falseActPer30)}
                note="days per month (red alert)"
                tone={r.falseActPer30 < 0.25 ? 'ok' : 'act'}
              />
              <Stat
                label="Healthy, never a false red alert"
                value={pct(r.healthyWithoutFalseAct, 1)}
                note={`of ${r.healthy} healthy astronauts over 60 days`}
              />
              <Stat label="Simulated astronauts" value={r.astronauts.toLocaleString()} note={`${r.withProblem} with a hidden problem`} />
            </dl>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="px-4 pt-4 text-left font-medium">Per problem</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="px-4 py-2 font-medium">Hidden problem</th>
                    <th scope="col" className="px-4 py-2 font-medium">“Serious” means</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Caught early</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Late</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Missed</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Warning ahead</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">False Watch / month</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byKind.map((k) => (
                    <tr key={k.kind} className="border-b border-border last:border-0">
                      <th scope="row" className="px-4 py-2 font-medium">
                        {PROBLEMS[k.kind].label}
                        <span className="block text-xs font-normal text-muted-foreground">{PROBLEMS[k.kind].story}</span>
                      </th>
                      <td className="px-4 py-2 text-muted-foreground">{PROBLEMS[k.kind].seriousText}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {k.caughtEarly}/{k.cases}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{k.caughtLate}</td>
                      <td className="px-4 py-2 text-right font-mono">{k.missed}</td>
                      <td className="px-4 py-2 text-right font-mono">{days(k.medianLeadDays)}</td>
                      <td className="px-4 py-2 text-right font-mono">{perMonth(k.falseWatchPer30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="changed-title" className="flex flex-col gap-3">
        <h2 id="changed-title" className="text-xl font-semibold">
          What the validation changed in the app
        </h2>
        <p className="max-w-3xl leading-relaxed text-muted-foreground">
          Our first rule raised Watch after a single odd day. The test showed healthy astronauts got almost 6 false Watch days a
          month, mostly from sleep and heart rate, which naturally jump around. Waiting for a second day on every vital
          fixed that but warned too late on fever and low oxygen. So heart rate and sleep now wait for a second day; everything
          else, and every red Act alert, still fires at once.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2 font-medium">Rule tested</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Caught before serious</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Missed</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">False Watch / month</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((rule) => {
                const x = results[rule]
                const ours = rule === 'app'
                return (
                  <tr key={rule} className={cn('border-b border-border last:border-0', ours && 'bg-primary/5')}>
                    <th scope="row" className="px-4 py-2 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {ours && <ShieldCheck className="size-4 text-primary" aria-hidden />}
                        {RULE_LABEL[rule]}
                      </span>
                    </th>
                    {x ? (
                      <>
                        <td className="px-4 py-2 text-right font-mono">{pct(x.caughtEarly, x.withProblem)}</td>
                        <td className="px-4 py-2 text-right font-mono">{x.missed}</td>
                        <td className="px-4 py-2 text-right font-mono">{perMonth(x.falseWatchPer30)}</td>
                      </>
                    ) : (
                      <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                        {running === rule ? 'Running…' : 'Waiting…'}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="limits-title" className="rounded-2xl border border-border bg-secondary/40 p-5">
        <h2 id="limits-title" className="font-semibold">
          Honest limits
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            These are simulated astronauts, not real people. It tests that our rules behave sensibly; it does not prove clinical
            accuracy. That needs real crew or analog-mission data.
          </li>
          <li>
            “Serious” comes from common clinical cut-offs (SpO₂ 92%, fever 38.0 °C, blood pressure 140 mmHg), not from our own
            thresholds, so the test cannot pass by definition.
          </li>
          <li>
            Blood pressure still gives about 1.5 false Watch days a month. Next step: average two cuff readings, as clinics do,
            instead of waiting a day.
          </li>
          <li>This is not AI or machine learning: the rules are fixed and explainable. The test only measures how well they work.</li>
        </ul>
      </section>
    </main>
  )
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'ok' | 'watch' | 'act' }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-1 font-mono text-3xl font-semibold',
          tone === 'ok' && 'text-status-ok',
          tone === 'watch' && 'text-status-watch',
          tone === 'act' && 'text-status-act',
        )}
      >
        {value}
      </dd>
      <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>
    </div>
  )
}
