'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      {/* Logo / Header */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#534AB7] flex items-center justify-center mx-auto mb-4 shadow-lg">
          <span className="text-white text-2xl font-bold">J&amp;M</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Finanzas J&amp;M</h1>
        <p className="text-gray-500 text-sm mt-1">Ingresá a tu cuenta</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        {/* Quick-select buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setEmail('javier@finanzasjm.app')}
            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              email === 'javier@finanzasjm.app'
                ? 'border-[#534AB7] bg-[#534AB7]/10 text-[#534AB7]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            Javier
          </button>
          <button
            type="button"
            onClick={() => setEmail('mary@finanzasjm.app')}
            className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
              email === 'mary@finanzasjm.app'
                ? 'border-[#534AB7] bg-[#534AB7]/10 text-[#534AB7]'
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            Mary
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <Input
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Contraseña</label>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center bg-red-50 py-2 px-3 rounded-lg">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </form>
    </div>
  )
}
