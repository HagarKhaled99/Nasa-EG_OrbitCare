import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '@/lib/utils'

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/85',
  outline: 'border-border bg-background hover:bg-muted hover:text-foreground',
  ghost: 'hover:bg-muted hover:text-foreground',
} as const

type Variant = keyof typeof variants

export function Button({
  variant = 'default',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={cn(base, variants[variant], 'h-11 px-4', className)} {...props} />
}

export function ButtonLink({
  variant = 'default',
  className,
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link className={cn(base, variants[variant], 'h-11 px-4', className)} {...props} />
}
