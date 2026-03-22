'use client'

import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { getOrInitSettings, subscribeToSettings } from '@/lib/settings'
import { Currency } from '@/types'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setMonedaBase } = useAuthStore()
  const { setSettings } = useSettingsStore()
  const settingsUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Tear down previous settings subscription
      settingsUnsubRef.current?.()
      settingsUnsubRef.current = null

      if (firebaseUser) {
        // Ensure user doc exists
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            nombre: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuario',
            email: firebaseUser.email,
            monedaBase: 'ARS',
          })
          setMonedaBase('ARS')
        } else {
          setMonedaBase((userSnap.data().monedaBase as Currency) ?? 'ARS')
        }

        // Init settings if first time + subscribe to changes
        await getOrInitSettings(firebaseUser.uid)
        settingsUnsubRef.current = subscribeToSettings(firebaseUser.uid, setSettings)

        setUser(firebaseUser)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      unsubAuth()
      settingsUnsubRef.current?.()
    }
  }, [setUser, setLoading, setMonedaBase, setSettings])

  return <>{children}</>
}
