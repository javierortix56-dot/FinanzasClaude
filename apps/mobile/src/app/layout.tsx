import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import AuthProvider from '@/components/AuthProvider'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
import AmbientBackground from '@/components/ui/AmbientBackground'
import './globals.css'

export const metadata: Metadata = {
  title: 'Finanzas J&M',
  description: 'App de finanzas personales para Javier y Mary',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finanzas J&M',
  },
}

export const viewport: Viewport = {
  // La barra de estado se funde con el fondo ambiental en vez de un bloque violeta
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f2fa' },
    { media: '(prefers-color-scheme: dark)',  color: '#0c0d14' },
  ],
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AmbientBackground />
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
