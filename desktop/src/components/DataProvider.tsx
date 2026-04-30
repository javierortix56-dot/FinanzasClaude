'use client'

import { useEffect, useRef, useState } from 'react'
import { useTransactionStore } from '@/store/useTransactionStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAssetStore } from '@/store/useAssetStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useAuthStore } from '@/store/useAuthStore'
import { subscribeToTransactions } from '@/lib/transactions'
import { subscribeToSettings, getOrInitSettings } from '@/lib/settings'
import { subscribeToAssets } from '@/lib/assets'
import { subscribeToBudgets } from '@/lib/budgets'
import { Currency } from '@/types'

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
