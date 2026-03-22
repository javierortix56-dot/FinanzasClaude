'use client'

import { useEffect, useRef } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getOrInitSettings, subscribeToSettings } from '@/lib/settings'
import { SHARED_USER_ID } from '@/lib/constants'
import { Currency } from '@/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const settingsUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Sign in anonymously so Firestore security rules are satisfied
    signInAnonymously(auth).catch(() => {})

    async function init() {
      const settings = await getOrInitSettings(SHARED_USER_ID)
      setMonedaBase(((settings as any).monedaBase ?? 'ARS') as Currency)
      settingsUnsubRef.current = subscribeToSettings(SHARED_USER_ID, setSettings)
    }
    init()
    return () => { settingsUnsubRef.current?.() }
  }, [setMonedaBase, setSettings])

  return <>{children}</>
}
