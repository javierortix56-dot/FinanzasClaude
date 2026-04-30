import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'income' | 'expense' | 'warning' | 'primary'

const tones: Record<Tone, string> = {
  neutral:  'bg-surface-2 text-foreground border-border',
  income:   'bg-income-soft text-income border-transparent',
  expense:  'bg-expense-soft text-expense border-transparent',
  warning:  'bg-unassigned-soft text-unassigned border-transparent',
  primary:  'bg-primary/10 text-primary border-transparent',
}

interface Props extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({ className, tone = 'neutral', ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}
