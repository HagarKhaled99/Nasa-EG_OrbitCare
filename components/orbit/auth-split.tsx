import Image from 'next/image'
import { Orbit } from 'lucide-react'
import type { Astronaut } from '@/lib/orbit/crew'

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Orbit className="size-5" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-mono text-sm font-semibold tracking-[0.2em]">ORBIT TWIN</span>
        <span className="text-xs text-muted-foreground">Your health twin</span>
      </span>
    </div>
  )
}

export function AuthSplit({
  figure,
  children,
}: {
  figure: Astronaut['figure']
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[42%] max-w-xl shrink-0 flex-col justify-between gap-6 border-r border-sidebar-border bg-sidebar p-8 lg:flex">
        <Logo />
        <div className="relative min-h-0 flex-1">
          <div className="absolute inset-[15%] rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <Image
            key={figure}
            src={`/images/body-twin-${figure}.png`}
            alt={`${figure === 'female' ? 'Female' : 'Male'} body twin figure`}
            fill
            priority
            sizes="40vw"
            className="object-contain [mask-image:radial-gradient(ellipse_34%_48%_at_center,black_72%,transparent_100%)]"
          />
        </div>
        <figure className="rounded-2xl border border-sidebar-border bg-card p-5">
          <blockquote className="text-lg leading-snug font-medium text-balance">
            &ldquo;Your flight surgeon is 20 minutes away. Your twin is right here.&rdquo;
          </blockquote>
          <figcaption className="mt-3 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            ARES-IV · Mars transit · Day 214
          </figcaption>
        </figure>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col px-5 py-8 md:px-10 lg:py-12">
        <div className="mb-8 lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">{children}</div>
      </main>
    </div>
  )
}
