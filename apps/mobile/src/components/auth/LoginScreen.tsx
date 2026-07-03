'use client'

import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { signIn } from '@finanzas/core/lib/auth'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = email.trim().length > 3 && password.length > 0 && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    const err = await signIn(email, password)
    if (err) {
      setError(err)
      setLoading(false)
    }
    // Si el login fue exitoso, onAuthStateChange actualiza el store y
    // AuthProvider desmonta esta pantalla — no hace falta hacer nada acá.
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] bg-gray-50 px-6">
      <div className="w-full max-w-[330px]">
        {/* Marca */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 mb-4">
            <span className="text-white font-black text-xl">J&M</span>
          </div>
          <h1 className="text-gray-900 font-bold text-2xl">Finanzas J&M</h1>
          <p className="text-gray-400 text-sm mt-1">Ingresá para ver tus finanzas</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-gray-500 mb-1.5">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-gray-500 mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-500 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><LogIn size={15} /> Iniciar sesión</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-gray-300 mt-6">
          Finanzas compartidas de Javier &amp; Mary
        </p>
      </div>
    </div>
  )
}
