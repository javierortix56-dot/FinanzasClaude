'use client'

import { InputHTMLAttributes, forwardRef, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@finanzas/core/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-xl border border-transparent bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted-2 transition-all focus-visible:outline-none focus-visible:bg-surface focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-xl border border-transparent bg-surface-2 px-3 text-sm text-foreground transition-all focus-visible:outline-none focus-visible:bg-surface focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-xl border border-transparent bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-2 transition-all focus-visible:outline-none focus-visible:bg-surface focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('eyebrow block mb-2', className)}
      {...props}
    />
  )
}
