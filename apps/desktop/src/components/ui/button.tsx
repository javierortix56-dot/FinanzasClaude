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
  primary:   'bg-brand text-primary-foreground shadow-card hover:brightness-110',
  secondary: 'glass text-foreground hover:bg-surface',
  ghost:     'text-foreground hover:bg-surface-2',
  danger:    'bg-expense text-white hover:brightness-110',
  outline:   'border border-border-strong bg-transparent text-foreground hover:bg-surface-2',
}

const sizes: Record<Size, string> = {
  sm:   'h-8 px-3 text-sm rounded-[10px]',
  md:   'h-10 px-4 text-sm rounded-xl',
  lg:   'h-11 px-5 text-base rounded-xl',
  icon: 'h-9 w-9 rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'primary', size = 'md', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,filter,transform] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})
