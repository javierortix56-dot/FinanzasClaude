import type { Metadata, Viewport } from 'next'
import AuthProvider from '@/components/AuthProvider'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'
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
  themeColor: '#10b981',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-gray-50">
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
