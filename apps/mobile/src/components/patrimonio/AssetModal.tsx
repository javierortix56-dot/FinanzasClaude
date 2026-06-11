'use client'

import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Trash2 } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { addAsset, updateAsset, deleteAsset } from '@finanzas/core/lib/assets'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { SHARED_USER_ID, getTodayLocal } from '@finanzas/core/lib/constants'
import { parseAmount } from '@finanzas/core/lib/parse'
import { Asset, Currency } from '@finanzas/core/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ACTIVO_TIPOS = ['banco', 'efectivo', 'cripto', 'inversiones', 'ahorro'] as const
const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Props {
  open: boolean
  onClose: () => void
  editing: Asset | null
}

export default function AssetModal({ open, onClose, editing }: Props) {
  const { settings } = useSettingsStore()
  const showToast = useUIStore((st) => st.showToast)
  const s = settings ?? DEFAULT_SETTINGS

  const pasivoTipos = s.tiposPasivo.length ? s.tiposPasivo : ['Tarjeta de crédito', 'Préstamo', 'Deuda']

  const [nombre,       setNombre]       = useState('')
  const [clase,        setClase]        = useState<'activo' | 'pasivo'>('activo')
  const [tipo,         setTipo]         = useState(ACTIVO_TIPOS[0] as string)
  const [moneda,       setMoneda]       = useState<Currency>('ARS')
  const [saldo,        setSaldo]        = useState('')
  const [fechaAlta,    setFechaAlta]    = useState(getTodayLocal())
  const [metaObjVal,   setMetaObjVal]   = useState('')
  const [metaMoneda,   setMetaMoneda]   = useState<Currency>('USD')
  const [saving,       setSaving]       = useState(false)
  const [deleteConfirm,setDeleteConfirm]= useState(false)

  const tiposActuales = clase === 'activo' ? ACTIVO_TIPOS : pasivoTipos

  useEffect(() => {
    if (!open) { setDeleteConfirm(false); return }
    if (editing) {
      setNombre(editing.nombre)
      setClase(editing.clase)
      setTipo(editing.tipo)
      setMoneda(editing.moneda)
      setSaldo(String(editing.saldo))
      setFechaAlta(editing.fechaAlta.toDate().toISOString().split('T')[0])
      setMetaObjVal(editing.metaObjetivo != null ? String(editing.metaObjetivo) : '')
      setMetaMoneda((editing.metaMoneda as Currency) ?? 'USD')
    } else {
      setNombre('')
      setClase('activo')
      setTipo(ACTIVO_TIPOS[0])
      setMoneda('ARS')
      setSaldo('')
      setFechaAlta(getTodayLocal())
      setMetaObjVal('')
      setMetaMoneda('USD')
    }
  }, [open, editing])

  // El reset de tipo al cambiar de clase se hace en el onClick del toggle
  // (acción del usuario), no en un effect: un effect sobre [clase] pisaba el
  // tipo recién cargado al abrir el modal en modo edición.
  function handleClaseChange(next: 'activo' | 'pasivo') {
    if (next === clase) return
    setClase(next)
    setTipo(next === 'activo' ? ACTIVO_TIPOS[0] : pasivoTipos[0])
  }

  async function handleSave() {
    if (!nombre) return
    setSaving(true)
    try {
      const saldoNum = saldo.trim() === '' ? 0 : (parseAmount(saldo) ?? 0)
      const altaDate = new Date(fechaAlta + 'T12:00:00')
      const altaMonth = `${altaDate.getFullYear()}-${String(altaDate.getMonth() + 1).padStart(2, '0')}`
      // Mantener snapshots existentes; si no hay ninguno para el mes de alta,
      // crear uno automáticamente que represente el aporte inicial.
      const baseSnaps = editing?.snapshots ?? []
      const hasAltaSnap = baseSnaps.some((sn) => sn.month === altaMonth)
      const snapshots = hasAltaSnap
        ? baseSnaps
        : [...baseSnaps, { month: altaMonth, aporte: saldoNum, saldo: saldoNum }]
            .sort((a, b) => a.month.localeCompare(b.month))

      const data: Omit<Asset, 'id'> = {
        userId: SHARED_USER_ID,
        nombre: nombre.trim(),
        clase,
        tipo,
        moneda,
        saldo: saldoNum,
        fechaAlta: { toDate: () => altaDate },
        metaObjetivo: metaObjVal ? parseAmount(metaObjVal) : null,
        metaMoneda: metaObjVal ? metaMoneda : null,
        snapshots,
      }
      if (editing?.id) await updateAsset(editing.id, data)
      else              await addAsset(data)
      onClose()
    } catch (err) {
      console.error('[AssetModal] save error:', err)
      showToast(err instanceof Error ? err.message : 'Error al guardar la cuenta', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setSaving(true)
    try { await deleteAsset(editing.id); onClose() }
    catch (err) {
      console.error('[AssetModal] delete error:', err)
      showToast(err instanceof Error ? err.message : 'Error al eliminar la cuenta', 'error')
      setDeleteConfirm(false)
    }
    finally { setSaving(false) }
  }

  const canSave = nombre.trim() && (saldo.trim() === '' || parseAmount(saldo) !== null)

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white rounded-t-2xl z-50 shadow-2xl outline-none"
          aria-describedby={undefined}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              {editing ? 'Editar cuenta' : 'Nueva cuenta'}
            </Dialog.Title>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors" aria-label="Cerrar">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="px-5 pt-4 pb-8 space-y-5 overflow-y-auto max-h-[78vh]">
            {/* Clase toggle */}
            <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
              {(['activo', 'pasivo'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => handleClaseChange(c)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                    clase === c ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {c === 'activo' ? 'Activo' : 'Pasivo'}
                </button>
              ))}
            </div>

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Nombre de la cuenta
              </label>
              <Input
                placeholder={clase === 'activo' ? 'Ej: Cuenta Bancolombia' : 'Ej: Tarjeta Visa'}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Tipo
              </label>
              <div className="flex flex-wrap gap-2">
                {tiposActuales.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all capitalize ${
                      tipo === t
                        ? 'bg-[#534AB7] text-white border-[#534AB7]'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Saldo + Moneda */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Saldo actual
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={saldo}
                  onChange={(e) => setSaldo(e.target.value)}
                  className="flex-1 text-2xl font-bold text-gray-900 bg-gray-50 rounded-xl px-4 py-3 border-0 outline-none focus:ring-2 focus:ring-[#534AB7]"
                />
                <div className="flex flex-col gap-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setMoneda(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        moneda === c ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Fecha de alta */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Fecha de alta
              </label>
              <Input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} />
            </div>

            {/* Meta de ahorro (solo activos) */}
            {clase === 'activo' && (
              <div className="space-y-2 p-4 bg-[#534AB7]/5 rounded-xl border border-[#534AB7]/10">
                <label className="text-xs font-semibold text-[#534AB7] uppercase tracking-wide">
                  Meta de ahorro (opcional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    placeholder="0"
                    value={metaObjVal}
                    onChange={(e) => setMetaObjVal(e.target.value)}
                    className="flex-1 text-lg font-bold text-gray-900 bg-white rounded-xl px-3 py-2.5 border border-gray-200 outline-none focus:ring-2 focus:ring-[#534AB7]"
                  />
                  <div className="flex gap-1">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setMetaMoneda(c)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          metaMoneda === c ? 'bg-[#534AB7] text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {metaObjVal && (
                  <p className="text-xs text-[#534AB7]/70">
                    La meta se mostrará como barra de progreso en la cuenta
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              {editing && (
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className={`w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-colors ${
                    deleteConfirm ? 'bg-red-400 border-red-400 text-white' : 'border-red-100 text-red-400 hover:bg-red-50'
                  }`}
                  title={deleteConfirm ? 'Confirmar eliminación' : 'Eliminar cuenta'}
                >
                  <Trash2 size={17} />
                </button>
              )}
              <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 h-11 text-base font-semibold">
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar cuenta'}
              </Button>
            </div>
            {deleteConfirm && (
              <p className="text-xs text-red-400 text-center -mt-2">
                Tocá el ícono rojo de nuevo para confirmar
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
