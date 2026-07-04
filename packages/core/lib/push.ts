import { supabase } from './supabase'

/**
 * Suscripción a notificaciones push (Web Push) por dispositivo.
 * La clave VAPID pública es pública por diseño; la privada vive solo en la
 * base (app_secrets) y la usa la Edge Function que envía los recordatorios.
 */
export const VAPID_PUBLIC_KEY =
  'BPsfFF8fupW4GJYTs7jmuG9pdBYRvg1r8aqhW8miOVJIPf5xQMa5xcHDuLQjbPUfeCjEQlYk1CwNWxzVduWnghM'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function pushSoportado(): boolean {
  return typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
}

/** Devuelve la suscripción activa de este dispositivo, si existe */
export async function getSuscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Pide permiso, suscribe este dispositivo y guarda la suscripción en la base.
 * Devuelve null si salió bien, o un mensaje de error para mostrar.
 */
export async function activarPush(usuario: string): Promise<string | null> {
  if (!pushSoportado()) {
    return 'Este navegador no soporta notificaciones. En iPhone: agregá la app a la pantalla de inicio primero.'
  }
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return 'Permiso de notificaciones denegado. Activalo desde los ajustes del navegador.'
  }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
  })
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      usuario,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return `Error guardando la suscripción: ${error.message}`
  return null
}

/** Desuscribe este dispositivo y borra la suscripción de la base */
export async function desactivarPush(): Promise<void> {
  const sub = await getSuscripcionActual()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
