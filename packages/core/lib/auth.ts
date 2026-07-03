import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useAuthStore } from '../store/useAuthStore'
import { clearTransactionCache } from '../store/useTransactionStore'
import { clearSettingsCache } from '../store/useSettingsStore'
import { SessionUser } from '../types'

function sessionToUser(session: Session | null): SessionUser | null {
  if (!session?.user?.email) return null
  return {
    id: session.user.id,
    email: session.user.email,
    nombre: (session.user.user_metadata?.nombre as string) ?? '',
  }
}

/**
 * Conecta la sesión de Supabase Auth con useAuthStore.
 * Llamar una sola vez al montar el provider raíz; devuelve el unsubscribe.
 * onAuthStateChange emite INITIAL_SESSION de entrada, así que también
 * resuelve el estado inicial (authReady).
 */
export function initAuth(): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    const store = useAuthStore.getState()
    store.setUser(sessionToUser(session))
    store.setAuthReady(true)
  })
  return () => subscription.unsubscribe()
}

/** Devuelve null si el login fue exitoso, o un mensaje de error para mostrar. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (!error) return null
  if (error.message.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos'
  }
  if (error.message.includes('Email not confirmed')) {
    return 'El email no está confirmado'
  }
  return error.message
}

export async function signOut(): Promise<void> {
  // Borrar los datos financieros persistidos en el dispositivo
  clearTransactionCache()
  clearSettingsCache()
  await supabase.auth.signOut()
}
