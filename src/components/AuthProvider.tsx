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
  const [authError, setAuthError] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Try anonymous sign-in; if it fails (disabled in Console) render anyway
        try {
          await signInAnonymously(auth)
        } catch (err) {
          console.error('[Auth] signInAnonymously failed:', err)
          // Anonymous auth disabled — render app anyway and let Firestore fail visibly
          setAuthError(true)
          setReady(true)
        }
        return
      }

      // Authenticated (anonymous or previously signed in) — load settings
      settingsUnsubRef.current?.()
      settingsUnsubRef.current = null

      try {
        const settings = await getOrInitSettings(SHARED_USER_ID)
        setMonedaBase(((settings as any).monedaBase ?? 'ARS') as Currency)
        settingsUnsubRef.current = subscribeToSettings(SHARED_USER_ID, setSettings)
      } catch (err) {
        console.error('[Auth] Settings load failed:', err)
      }
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

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl">🔥</div>
        <h2 className="text-gray-800 font-bold text-lg">Firebase no conectado</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          La <strong>autenticación anónima</strong> está deshabilitada en Firebase Console.
          Habilitala en:<br />
          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mt-2 inline-block">
            Authentication → Sign-in method → Anonymous
          </span>
        </p>
      </div>
    )
  }

  return <>{children}</>
}
