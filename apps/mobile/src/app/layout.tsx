import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import AuthProvider from '@/components/AuthProvider'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import AmbientBackground from '@/components/ui/AmbientBackground'
import { THEME_BOOT_SCRIPT } from '@/lib/theme'
import { APPLE_TOUCH_ICON_DATA_URI } from '@/lib/icon-data'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finanzas J&M',
  description: 'App de finanzas personales para Javier y Mary',
  // Íconos: el de iOS va incrustado como data URI (iOS no necesita descargar nada al
  // "Agregar a inicio") y coincide con el del manifest. Sin `icons.shortcut`.
  icons: {
    icon: [{ url: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: APPLE_TOUCH_ICON_DATA_URI, sizes: '180x180', type: 'image/png' }],
  },
  // Next 16 solo emite `mobile-web-app-capable`; iOS lee la variante con prefijo apple-
  other: { 'apple-mobile-web-app-capable': 'yes' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finanzas J&M',
  },
}

export const viewport: Viewport = {
  // La barra de estado se funde con el fondo ambiental en vez de un bloque violeta
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f1ec' },
    { media: '(prefers-color-scheme: dark)',  color: '#121517' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Tema manual guardado: se aplica antes del primer pintado */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AmbientBackground />
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
