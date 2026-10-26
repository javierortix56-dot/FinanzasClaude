'use client'

import { HTMLAttributes } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@finanzas/core/lib/utils'

type CardProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: React.ReactNode
  /** Retraso de entrada (s) para escalonar tarjetas */
  delay?: number
}

/** Tarjeta glass con entrada animada (fade + desplazamiento corto) */
export function Card({ className, delay = 0, ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('rounded-[20px] glass', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pt-5 pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('eyebrow', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pb-6', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4 border-t border-hairline', className)} {...props} />
}
