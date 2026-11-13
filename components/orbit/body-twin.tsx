'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ORGANS, type OrganId } from '@/lib/orbit/organs'
import type { Status } from '@/lib/orbit/health'
import { STATUS_STYLE } from '@/lib/orbit/status-style'
import { useOrbit } from './orbit-provider'

type HotspotStatus = Status | 'neutral'

const LABEL_LEFT: OrganId[] = ['eyes', 'muscles', 'blood', 'bones']

interface BodyTwinProps {
  statuses: Partial<Record<OrganId, HotspotStatus>>
  linkToOrgan?: boolean
  className?: string
  caption?: string
}

export function BodyTwin({ statuses, linkToOrgan = true, className, caption }: BodyTwinProps) {
  const { astronaut } = useOrbit()
  return (
    <figure className={cn('relative mx-auto w-full max-w-[360px]', className)}>
      <div className="relative aspect-[768/1376] w-full">
        <div
          aria-hidden
          className="absolute inset-[8%] rounded-full bg-primary/10 blur-3xl"
        />
        <Image
          src={`/images/body-twin-${astronaut.figure}.png`}
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 360px, 80vw"
          className="object-contain [mask-image:radial-gradient(ellipse_50%_56%_at_center,black_72%,transparent_100%)]"
        />
        {ORGANS.map((organ) => {
          const status = statuses[organ.id]
          if (!status) return null
          const style = status === 'neutral' ? null : STATUS_STYLE[status]
          const label = `${organ.shortName}: ${style ? style.label : 'not projected'}`
          const left = LABEL_LEFT.includes(organ.id)

          const content = (
            <>
              <span className="relative flex size-6 items-center justify-center">
                {style && status !== 'normal' && (
                  <span
                    aria-hidden
                    className={cn('orbit-pulse absolute inset-0 rounded-full', style.bg)}
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    'relative size-4 rounded-full border-2 border-background shadow-[0_0_12px_2px] transition-colors',
                    style ? style.bg : 'bg-muted-foreground/60',
                  )}
                  style={{ color: style ? style.color : 'transparent' }}
                />
              </span>
              <span
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 rounded-md border bg-background/85 px-2 py-0.5 text-xs font-medium whitespace-nowrap backdrop-blur transition-colors',
                  left ? 'right-full mr-1.5' : 'left-full ml-1.5',
                  style ? style.border : 'border-border text-muted-foreground',
                  linkToOrgan && 'group-hover:bg-secondary',
                )}
              >
                {organ.shortName}
              </span>
            </>
          )

          const positionStyle = {
            left: `${organ.position.x}%`,
            top: `${organ.position.y}%`,
          }
          const baseClass =
            'group absolute flex -translate-x-1/2 -translate-y-1/2 items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

          return linkToOrgan ? (
            <Link
              key={organ.id}
              href={`/organ/${organ.id}`}
              aria-label={`${label}. Open ${organ.name} panel`}
              className={baseClass}
              style={positionStyle}
            >
              {content}
            </Link>
          ) : (
            <span key={organ.id} role="img" aria-label={label} className={baseClass} style={positionStyle}>
              {content}
            </span>
          )
        })}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  )
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-xs', className)}>
      {(['normal', 'watch', 'act'] as Status[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2.5 rounded-full', STATUS_STYLE[s].bg)} />
          <span className="font-medium">{STATUS_STYLE[s].label}</span>
          <span className="text-muted-foreground">
            {s === 'normal' ? '< 10% from your normal' : s === 'watch' ? '10–20%' : '> 20% or medical limit'}
          </span>
        </li>
      ))}
    </ul>
  )
}
