'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { getOrInitSettings, subscribeToSettings } from '@finanzas/core/lib/settings'
import { Currency } from '@finanzas/core/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const settingsUnsubRef = useRef<(() => void) | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function init() {
      try {
        const settings = await getOrInitSettings('shared')
        setMonedaBase(((settings as unknown as Record<string, unknown>).monedaBase ?? 'ARS') as Currency)
        settingsUnsubRef.current = subscribeToSettings('shared', setSettings)
        setSettings(settings)
      } catch (err) {
        console.error('[AuthProvider] settings load failed:', err)
      }
      setReady(true)
    }

    init()

    return () => {
      settingsUnsubRef.current?.()
    }
  }, [setMonedaBase, setSettings])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <>{children}</>
}
