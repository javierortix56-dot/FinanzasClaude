'use client'

import { useEffect, useRef, useState } from 'react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { subscribeToTransactions } from '@finanzas/core/lib/transactions'
import { subscribeToSettings, getOrInitSettings } from '@finanzas/core/lib/settings'
import { subscribeToAssets } from '@finanzas/core/lib/assets'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { Currency } from '@finanzas/core/types'

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const { setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const { setTransactions } = useTransactionStore()
  const { setAssets } = useAssetStore()
  const { setBudgets } = useBudgetStore()
  const currentMonth = useTransactionStore((s) => s.currentMonth)

  const settingsUnsub = useRef<(() => void) | null>(null)
  const txUnsub       = useRef<(() => void) | null>(null)
  const assetsUnsub   = useRef<(() => void) | null>(null)
  const budgetsUnsub  = useRef<(() => void) | null>(null)

  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const settings = await getOrInitSettings('shared')
        if (cancelled) return
        setMonedaBase(((settings as unknown as Record<string, unknown>).monedaBase ?? 'ARS') as Currency)
        setSettings(settings)
        settingsUnsub.current = subscribeToSettings('shared', setSettings)
        assetsUnsub.current   = subscribeToAssets(setAssets)
      } catch (err) {
        console.error('[DataProvider] init failed:', err)
      }
      setReady(true)
    }
    init()
    return () => {
      cancelled = true
      settingsUnsub.current?.()
      assetsUnsub.current?.()
    }
  }, [setMonedaBase, setSettings, setAssets])

  useEffect(() => {
    txUnsub.current?.()
    txUnsub.current = subscribeToTransactions(currentMonth, setTransactions)
    budgetsUnsub.current?.()
    budgetsUnsub.current = subscribeToBudgets(currentMonth, setBudgets)
    return () => {
      txUnsub.current?.()
      budgetsUnsub.current?.()
    }
  }, [currentMonth, setTransactions, setBudgets])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
