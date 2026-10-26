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
import { syncCotizaciones } from '@finanzas/core/lib/cotizaciones'
import { subscribeToAssets } from '@finanzas/core/lib/assets'
import { subscribeToBudgets } from '@finanzas/core/lib/budgets'
import { Settings } from '@finanzas/core/types'
import LoginScreen from '@/components/auth/LoginScreen'
import { motion } from 'motion/react'

export default function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const { setMonthTransactions } = useTransactionStore()
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
        // Cotización del día + historial mensual (MEP/TRM); el realtime trae el resultado
        syncCotizaciones(settings)
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
    txUnsub.current = subscribeToTransactions(currentMonth, (txs) => setMonthTransactions(currentMonth, txs))
    budgetsUnsub.current?.()
    budgetsUnsub.current = subscribeToBudgets(currentMonth, setBudgets)
    return () => {
      txUnsub.current?.()
      budgetsUnsub.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentMonth, setMonthTransactions, setBudgets])

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          className="h-14 w-14 rounded-2xl bg-brand shadow-card-lg flex items-center justify-center"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-white font-black text-sm">J&amp;M</span>
        </motion.div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return <>{children}</>
}
