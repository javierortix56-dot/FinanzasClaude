'use client'

import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // No session yet — sign in anonymously; this will trigger onAuthStateChanged again
        signInAnonymously(auth).catch(() => {})
        return
      }

      // Authenticated (including anonymous) — load settings then reveal the app
      settingsUnsubRef.current?.()
      settingsUnsubRef.current = null

      const settings = await getOrInitSettings(SHARED_USER_ID)
      setMonedaBase(((settings as any).monedaBase ?? 'ARS') as Currency)
      settingsUnsubRef.current = subscribeToSettings(SHARED_USER_ID, setSettings)
      setReady(true)
    })

    return () => {
      unsub()
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
