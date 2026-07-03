'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { initAuth } from '@finanzas/core/lib/auth'
import { getOrInitSettings, subscribeToSettings } from '@finanzas/core/lib/settings'
import { Settings } from '@finanzas/core/types'
import LoginScreen from '@/components/auth/LoginScreen'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, authReady, setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()

  // Sesión de Supabase Auth → store (resuelve también la sesión inicial)
  useEffect(() => initAuth(), [])

  // Settings solo se cargan con sesión activa (RLS bloquea el acceso anónimo)
  useEffect(() => {
    if (!user) return
    let cancelled = false
    let unsub: (() => void) | null = null

    const apply = (s: Settings) => {
      setSettings(s)
      setMonedaBase(s.monedaBase ?? 'ARS')
    }

    async function init() {
      try {
        const settings = await getOrInitSettings('shared')
        if (cancelled) return
        apply(settings)
        unsub = subscribeToSettings('shared', apply)
      } catch (err) {
        console.error('[AuthProvider] settings load failed:', err)
      }
    }

    init()

    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setSettings, setMonedaBase])

  // Splash mínimo mientras se resuelve la sesión persistida (evita flash de login)
  if (!authReady) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-gray-50">
        <div className="w-7 h-7 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LoginScreen />

  return <>{children}</>
}
