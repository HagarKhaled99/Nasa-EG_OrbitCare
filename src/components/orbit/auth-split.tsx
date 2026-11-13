import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Orbit } from 'lucide-react'

/** Deterministic star field so the panel looks identical on every render (and in screenshots). */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  return {
    x: r(1) * 100,
    y: r(2) * 100,
    size: r(3) < 0.85 ? 1 : 2,
    opacity: 0.25 + r(4) * 0.6,
    delay: r(5) * 6,
    duration: 2.5 + r(6) * 4,
    twinkle: r(7) < 0.6,
  }
})

const ORBIT_PATH = 'M -40 470 Q 260 180 640 290'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!query) return
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={
          onDark
            ? 'flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white backdrop-blur'
            : 'flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary'
        }
      >
        <Orbit className={onDark ? 'size-7' : 'size-5'} aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={
            onDark
              ? 'font-mono text-2xl font-semibold tracking-[0.3em] text-white'
              : 'font-mono text-sm font-semibold tracking-[0.2em]'
          }
        >
          ORBIT TWIN
        </span>
        <span className={onDark ? 'text-sm text-white/70' : 'text-xs text-muted-foreground'}>Your health twin</span>
      </span>
    </div>
  )
}

function SpacePanel() {
  const reducedMotion = usePrefersReducedMotion()
  return (
    <aside
      aria-label="ORBIT TWIN"
      className="orbit-space sticky top-0 hidden h-dvh w-[37%] max-w-[580px] shrink-0 flex-col justify-between overflow-hidden p-10 text-white lg:flex"
    >
      {/* Twinkling star field */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.size}
            fill="white"
            opacity={s.opacity}
            className={s.twinkle ? 'orbit-twinkle' : undefined}
            style={
              s.twinkle
                ? ({ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s`, '--star-o': s.opacity } as React.CSSProperties)
                : undefined
            }
          />
        ))}
      </svg>

      {/* Shooting stars */}
      <span aria-hidden className="orbit-shooting-star" style={{ top: '14%', left: '20%' }} />
      <span aria-hidden className="orbit-shooting-star" style={{ top: '38%', left: '55%', animationDelay: '6.5s' }} />

      {/* Orbits with a travelling satellite */}
      <svg
        aria-hidden
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <defs>
          <radialGradient id="orbit-sat-glow">
            <stop offset="0%" stopColor="oklch(0.85 0.12 290)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="oklch(0.7 0.18 290)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <path d={ORBIT_PATH} fill="none" stroke="white" strokeOpacity="0.18" strokeWidth="1.2" />
        <path
          d="M -40 560 Q 280 250 640 360"
          fill="none"
          stroke="white"
          strokeOpacity="0.14"
          strokeWidth="1"
          strokeDasharray="2 6"
          className="orbit-dash-drift"
        />
        {reducedMotion ? (
          <circle cx="150" cy="373" r="4" fill="oklch(0.7 0.15 290)" />
        ) : (
          <g>
            <circle r="16" fill="url(#orbit-sat-glow)">
              <animateMotion dur="16s" repeatCount="indefinite" path={ORBIT_PATH} />
            </circle>
            <circle r="4" fill="oklch(0.8 0.14 290)">
              <animateMotion dur="16s" repeatCount="indefinite" path={ORBIT_PATH} />
            </circle>
          </g>
        )}
      </svg>

      {/* Floating planet with breathing glow */}
      <div aria-hidden className="orbit-planet-float pointer-events-none absolute -right-28 -bottom-40 size-[420px]">
        <div className="orbit-planet size-full rounded-full" />
        <div className="orbit-planet-shine absolute inset-0 rounded-full" />
      </div>

      <div className="orbit-fade-up relative flex flex-col gap-10">
        <Logo onDark />
        <div className="border-b border-white/15 pb-6 font-mono text-[13px] tracking-[0.3em] uppercase">
          <p className="text-white/85">Astronaut health monitoring</p>
          <p className="mt-2 text-[11px] text-white/55">Real-time · Personalized · Mission ready</p>
        </div>
      </div>

      <div className="orbit-fade-up relative flex flex-col gap-6" style={{ animationDelay: '0.35s' }}>
        <p className="font-mono text-lg leading-relaxed tracking-[0.2em] text-white/90 uppercase">
          Better data.
          <br />
          Healthier missions.
        </p>
      </div>
    </aside>
  )
}

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <SpacePanel />
      <main className="flex min-w-0 flex-1 flex-col px-4 py-8 sm:px-8 md:px-12 lg:py-14">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[580px] flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  )
}

/** "Sign in | Sign up" switcher shown at the top of both auth pages. */
export function AuthTabs({ active }: { active: 'signin' | 'signup' }) {
  const tabs = [
    { id: 'signin', label: 'Sign in', to: '/login' },
    { id: 'signup', label: 'Sign up', to: '/signup' },
  ] as const
  return (
    <nav aria-label="Sign in or sign up" className="grid grid-cols-2 gap-1 rounded-2xl border border-border bg-secondary/60 p-1">
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <Link
            key={tab.id}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={
              'flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ' +
              (isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
