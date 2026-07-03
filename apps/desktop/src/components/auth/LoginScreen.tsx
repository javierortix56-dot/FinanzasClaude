'use client'

import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { signIn } from '@finanzas/core/lib/auth'
import { Button } from '@/components/ui/button'

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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-4">
            <span className="text-primary-foreground font-black text-lg">J&M</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Finanzas J&M</h1>
          <p className="text-sm text-muted mt-1">Ingresá para ver tus finanzas</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-surface p-6 space-y-4 shadow-sm"
        >
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold text-muted mb-1.5">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold text-muted mb-1.5">Contraseña</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-expense/30 bg-expense/10 px-3 py-2.5 text-xs font-medium text-expense">
              {error}
            </div>
          )}

          <Button type="submit" disabled={!canSubmit} className="w-full gap-2">
            {loading
              ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <><LogIn className="h-4 w-4" /> Iniciar sesión</>
            }
          </Button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          Finanzas compartidas de Javier &amp; Mary
        </p>
      </div>
    </div>
  )
}
