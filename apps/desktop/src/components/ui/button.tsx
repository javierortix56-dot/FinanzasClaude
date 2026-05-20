'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@finanzas/core/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary:   'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'bg-surface text-foreground border border-border hover:bg-surface-2',
  ghost:     'text-foreground hover:bg-surface-2',
  danger:    'bg-expense text-white hover:bg-red-700',
  outline:   'border border-border-strong bg-transparent text-foreground hover:bg-surface-2',
}

const sizes: Record<Size, string> = {
  sm:   'h-8 px-3 text-sm rounded-md',
  md:   'h-10 px-4 text-sm rounded-md',
  lg:   'h-11 px-5 text-base rounded-lg',
  icon: 'h-9 w-9 rounded-md',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
