'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { getOrInitSettings, subscribeToSettings } from '@finanzas/core/lib/settings'
import { Currency } from '@finanzas/core/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const settingsUnsubRef = useRef<(() => void) | null>(null)

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
    }

    init()

    return () => {
      settingsUnsubRef.current?.()
    }
  }, [setMonedaBase, setSettings])

  // El shell se renderiza de inmediato, sin bloquear con un spinner a pantalla
  // completa. El store de settings arranca con defaults válidos, así que las
  // pantallas pintan al instante y se actualizan cuando llegan los datos reales.
  return <>{children}</>
}
