'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { getOrInitSettings, subscribeToSettings } from '@finanzas/core/lib/settings'
import { Settings } from '@finanzas/core/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const settingsUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Mantener settings y monedaBase sincronizados (también ante updates
    // en tiempo real desde otro dispositivo)
    function applySettings(settings: Settings) {
      setSettings(settings)
      setMonedaBase(settings.monedaBase ?? 'ARS')
    }

    async function init() {
      try {
        const settings = await getOrInitSettings('shared')
        settingsUnsubRef.current = subscribeToSettings('shared', applySettings)
        applySettings(settings)
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
