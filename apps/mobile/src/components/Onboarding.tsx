'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import { Link2, CreditCard, EyeOff, Hand, X } from 'lucide-react'
import { useOnboardingStore, onboardingVisto, marcarOnboardingVisto } from '@/lib/onboarding'
import { springSoft } from '@/components/ui/motion'

const SLIDES = [
  {
    icon: Link2,
    tint: '#2f5363',
    title: 'Cada gasto, con su ingreso',
    body: 'En Asignación vinculan cada egreso al sueldo o ingreso que lo pagó. Auto-asignar lo resuelve por fecha y disponible; un egreso se puede dividir entre dos ingresos.',
  },
  {
    icon: CreditCard,
    tint: '#0ea5e9',
    title: 'Cuotas bajo control',
    body: 'En Análisis → Cuotas cargan compras en cuotas o importan el resumen de la tarjeta. La app proyecta cuánto comprometen los próximos meses.',
  },
  {
    icon: Hand,
    tint: '#4e7d5b',
    title: 'Gestos rápidos',
    body: 'Deslizá un movimiento a la derecha para marcarlo ejecutado o a la izquierda para eliminarlo. Si te equivocás, tocá "Deshacer" en el aviso.',
  },
  {
    icon: EyeOff,
    tint: '#b4533f',
    title: 'Privacidad primero',
    body: 'La app abre con los montos ocultos. Tocá el ojo para mostrarlos durante la sesión; se vuelven a ocultar al reabrir.',
  },
]

export default function Onboarding() {
  const { open, setOpen } = useOnboardingStore()
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)

  // Primera vez en este dispositivo: se abre sola
  useEffect(() => {
    if (!onboardingVisto()) setOpen(true)
  }, [setOpen])

  function go(n: number) {
    if (n < 0 || n >= SLIDES.length) return
    setDir(n > i ? 1 : -1)
    setI(n)
  }

  function close() {
    marcarOnboardingVisto()
    setOpen(false)
    setTimeout(() => setI(0), 400)
  }

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -60) go(i + 1)
    else if (info.offset.x > 60) go(i - 1)
  }

  const slide = SLIDES[i]
  const Icon = slide.icon
  const last = i === SLIDES.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Introducción"
        >
          <motion.div
            className="w-full max-w-[390px] sheet-surface rounded-t-[32px] px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-hidden"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springSoft}
          >
            <div className="flex justify-end">
              <button onClick={close} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-500/10 text-gray-500" aria-label="Cerrar introducción">
                <X size={16} />
              </button>
            </div>

            <div className="relative h-[290px]">
              <AnimatePresence initial={false} custom={dir} mode="popLayout">
                <motion.div
                  key={i}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ x: d * 80, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (d: number) => ({ x: d * -80, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.4}
                  onDragEnd={handleDragEnd}
                  className="absolute inset-0 flex flex-col items-center text-center pt-2"
                >
                  <motion.div
                    initial={{ scale: 0.6, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
                    className="w-20 h-20 rounded-[26px] flex items-center justify-center text-white shadow-lift mb-6"
                    style={{ background: `linear-gradient(135deg, ${slide.tint}bb, ${slide.tint})` }}
                  >
                    <Icon size={34} />
                  </motion.div>
                  <h2 className="text-[22px] font-bold tracking-tight text-gray-900">{slide.title}</h2>
                  <p className="text-sm text-gray-500 mt-2.5 leading-relaxed">{slide.body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Indicadores */}
            <div className="flex justify-center gap-1.5 mb-5">
              {SLIDES.map((_, n) => (
                <button key={n} onClick={() => go(n)} className="hit-44 h-2 flex items-center" aria-label={`Paso ${n + 1}`}>
                  <motion.span
                    className="block h-2 rounded-full"
                    animate={{ width: n === i ? 22 : 8, backgroundColor: n === i ? 'var(--primary)' : 'var(--color-gray-300)' }}
                  />
                </button>
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => (last ? close() : go(i + 1))}
              className="w-full h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft"
            >
              {last ? 'Empezar' : 'Siguiente'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
