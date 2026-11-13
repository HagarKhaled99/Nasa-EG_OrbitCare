import type { Status } from './health'

export const STATUS_STYLE: Record<
  Status,
  { label: string; text: string; bg: string; soft: string; border: string; color: string }
> = {
  normal: {
    label: 'Normal',
    text: 'text-status-ok',
    bg: 'bg-status-ok',
    soft: 'bg-status-ok/12',
    border: 'border-status-ok/40',
    color: 'var(--status-ok)',
  },
  watch: {
    label: 'Watch',
    text: 'text-status-watch',
    bg: 'bg-status-watch',
    soft: 'bg-status-watch/12',
    border: 'border-status-watch/40',
    color: 'var(--status-watch)',
  },
  act: {
    label: 'Act',
    text: 'text-status-act',
    bg: 'bg-status-act',
    soft: 'bg-status-act/12',
    border: 'border-status-act/40',
    color: 'var(--status-act)',
  },
}

export function formatValue(value: number, decimals: number) {
  return value.toFixed(decimals)
}
