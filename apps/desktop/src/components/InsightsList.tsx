'use client'

import { motion } from 'motion/react'
import { TrendingUp, TrendingDown, PiggyBank, Gauge, AlertTriangle, Clock } from 'lucide-react'
import { Insight, InsightIcon } from '@finanzas/core/lib/insights'
import { MoneyText } from '@/components/MoneyText'
import { cn } from '@finanzas/core/lib/utils'

const ICONS: Record<InsightIcon, React.ComponentType<{ className?: string }>> = {
  up: TrendingUp, down: TrendingDown, piggy: PiggyBank, gauge: Gauge, alert: AlertTriangle, clock: Clock,
}

const TONES = {
  good: 'bg-income-soft text-income',
  bad: 'bg-expense-soft text-expense',
  info: 'bg-primary/12 text-primary',
}

/** Lista de insights en lenguaje natural (cálculo compartido en core) */
export function InsightsList({ insights, base, columns = 1 }: { insights: Insight[]; base: string; columns?: 1 | 2 }) {
  return (
    <div className={cn('grid gap-3', columns === 2 && 'md:grid-cols-2')}>
      {insights.map((ins, i) => {
        const Icon = ICONS[ins.icon]
        return (
          <motion.div
            key={ins.key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            className="flex items-start gap-3"
          >
            <span className={cn('h-8 w-8 rounded-xl inline-flex items-center justify-center shrink-0', TONES[ins.tone])}>
              <Icon className="h-4 w-4" />
            </span>
            <p className="text-sm text-foreground/85 leading-snug pt-1.5">
              {ins.segments.map((seg, j) =>
                typeof seg === 'string' ? seg
                  : 'bold' in seg ? <b key={j} className="text-foreground">{seg.bold}</b>
                    : <MoneyText key={j} amount={Math.round(seg.money)} currency={base} className="font-semibold text-foreground" />,
              )}
            </p>
          </motion.div>
        )
      })}
    </div>
  )
}
