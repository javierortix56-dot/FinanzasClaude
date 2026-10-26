'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { fieldClass } from '@/components/ui/Sheet'
import { springPop } from '@/components/ui/motion'
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
    <div className="flex flex-col items-center justify-center min-h-[100dvh] px-6">
      <div className="w-full max-w-[330px]">
        {/* Marca */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={springPop}
            className="w-[72px] h-[72px] rounded-[24px] bg-brand flex items-center justify-center shadow-lift mb-5"
          >
            <span className="text-white font-black text-xl">J&amp;M</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-900 font-bold text-[28px] tracking-tight"
          >
            Finanzas J&amp;M
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="text-gray-400 text-sm mt-1"
          >
            Ingresá para ver tus finanzas
          </motion.p>
        </div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={handleSubmit}
          className="glass-strong rounded-[28px] p-5 space-y-4"
        >
          <div>
            <label htmlFor="login-email" className="eyebrow block mb-2">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className={fieldClass}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="eyebrow block mb-2">Contraseña</label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`${fieldClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-500/10"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -4, 4, 0] }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35 }}
                className="overflow-hidden"
              >
                <div className="bg-rose-500/10 ring-1 ring-rose-500/20 rounded-2xl px-3 py-2.5 text-xs text-rose-500 font-medium">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            whileTap={{ scale: 0.97 }}
            disabled={!canSubmit}
            className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-soft disabled:opacity-40"
          >
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><LogIn size={15} /> Iniciar sesión</>
            }
          </motion.button>
        </motion.form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Finanzas compartidas de Javier &amp; Mary
        </p>
      </div>
    </div>
  )
}
