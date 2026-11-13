import { cn } from '@/lib/utils'
import { styleFor, type ShownStatus } from '@/lib/orbit/status-style'

export function StatusPill({
  status,
  className,
  size = 'sm',
}: {
  status: ShownStatus
  className?: string
  size?: 'sm' | 'lg'
}) {
  const style = styleFor(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        style.border,
        style.soft,
        style.text,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', style.bg)} />
      {style.label}
    </span>
  )
}
