import type { MetadataRoute } from 'next'
import { APPLE_TOUCH_ICON_DATA_URI } from '@/lib/icon-data'

// Los íconos son los mismos que los de las etiquetas HTML (ver layout.tsx). `scope: '/'` es
// obligatorio: sin él la app instalada muestra la barra de Safari al cambiar de sección.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Finanzas J&M',
    short_name: 'Finanzas',
    description: 'App de finanzas personales para Javier y Mary',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f3f1ec',
    theme_color: '#f3f1ec',
    orientation: 'portrait',
    icons: [
      { src: APPLE_TOUCH_ICON_DATA_URI, sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
