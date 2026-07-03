'use client'

import { useEffect, useRef } from 'react'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useBudgetStore } from '@finanzas/core/store/useBudgetStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { initAuth } from '@finanzas/core/lib/auth'
import { subscribeToTransactions } from '@finanzas/core/lib/transactions'
import { subscribeToSettings, getOrInitSettings } from '@finanzas/core/lib/settings'
import { subscribeToAssets } from '@finanzas/core/lib/assets'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { Settings } from '@finanzas/core/types'
import LoginScreen from '@/components/auth/LoginScreen'

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const { setTransactions } = useTransactionStore()
  const { setAssets } = useAssetStore()
  const { setBudgets } = useBudgetStore()
  const currentMonth = useTransactionStore((s) => s.currentMonth)

  const settingsUnsub = useRef<(() => void) | null>(null)
  const txUnsub       = useRef<(() => void) | null>(null)
  const assetsUnsub   = useRef<(() => void) | null>(null)
  const budgetsUnsub  = useRef<(() => void) | null>(null)

  // Sesión de Supabase Auth → store (resuelve también la sesión inicial)
  useEffect(() => initAuth(), [])

  // Settings + assets: solo con sesión activa (RLS bloquea el acceso anónimo)
  useEffect(() => {
    if (!user) return
    let cancelled = false

    const apply = (s: Settings) => {
      setSettings(s)
      setMonedaBase(s.monedaBase ?? 'ARS')
    }

    async function init() {
      try {
        const settings = await getOrInitSettings('shared')
        if (cancelled) return
        apply(settings)
        settingsUnsub.current = subscribeToSettings('shared', apply)
        assetsUnsub.current   = subscribeToAssets(setAssets)
      } catch (err) {
        console.error('[DataProvider] init failed:', err)
      }
    }
    init()
    return () => {
      cancelled = true
      settingsUnsub.current?.()
      assetsUnsub.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setMonedaBase, setSettings, setAssets])

  useEffect(() => {
    if (!user) return
    txUnsub.current?.()
    txUnsub.current = subscribeToTransactions(currentMonth, setTransactions)
    budgetsUnsub.current?.()
    budgetsUnsub.current = subscribeToBudgets(currentMonth, setBudgets)
    return () => {
      txUnsub.current?.()
      budgetsUnsub.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentMonth, setTransactions, setBudgets])

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return <>{children}</>
}
