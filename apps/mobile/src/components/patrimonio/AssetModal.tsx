'use client'

import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Trash2 } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { addAsset, updateAsset, deleteAsset, restoreAsset } from '@finanzas/core/lib/assets'
import { offerUndo } from '@/lib/undo'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { SHARED_USER_ID, toLocalDateString } from '@finanzas/core/lib/constants'
import { Asset, Currency } from '@finanzas/core/types'
import Sheet, { FieldLabel, fieldClass, amountFieldClass } from '@/components/ui/Sheet'
import Segmented from '@/components/ui/Segmented'
import Collapse from '@/components/ui/Collapse'

const ACTIVO_TIPOS = ['banco', 'efectivo', 'cripto', 'inversiones', 'ahorro'] as const
const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

interface Props {
  open: boolean
  onClose: () => void
  editing: Asset | null
}

export default function AssetModal({ open, onClose, editing }: Props) {
  const { settings } = useSettingsStore()
  const s = settings ?? DEFAULT_SETTINGS

  const pasivoTipos = s.tiposPasivo.length ? s.tiposPasivo : ['Tarjeta de crédito', 'Préstamo', 'Deuda']

  const [nombre,       setNombre]       = useState('')
  const [clase,        setClase]        = useState<'activo' | 'pasivo'>('activo')
  const [tipo,         setTipo]         = useState(ACTIVO_TIPOS[0] as string)
  const [moneda,       setMoneda]       = useState<Currency>('ARS')
  const [saldo,        setSaldo]        = useState('')
  const [fechaAlta,    setFechaAlta]    = useState(toLocalDateString())
  const [metaObjVal,   setMetaObjVal]   = useState('')
  const [metaMoneda,   setMetaMoneda]   = useState<Currency>('USD')
  const [saving,       setSaving]       = useState(false)

  const tiposActuales = clase === 'activo' ? ACTIVO_TIPOS : pasivoTipos

  useEffect(() => {
    if (!open) return
    if (editing) {
      setNombre(editing.nombre)
      setClase(editing.clase)
      setTipo(editing.tipo)
      setMoneda(editing.moneda)
      setSaldo(String(editing.saldo))
      setFechaAlta(toLocalDateString(editing.fechaAlta.toDate()))
      setMetaObjVal(editing.metaObjetivo != null ? String(editing.metaObjetivo) : '')
      setMetaMoneda((editing.metaMoneda as Currency) ?? 'USD')
    } else {
      setNombre('')
      setClase('activo')
      setTipo(ACTIVO_TIPOS[0])
      setMoneda('ARS')
      setSaldo('')
      setFechaAlta(toLocalDateString())
      setMetaObjVal('')
      setMetaMoneda('USD')
    }
  }, [open, editing])

  // Sync tipo when clase changes
  useEffect(() => {
    setTipo(clase === 'activo' ? ACTIVO_TIPOS[0] : pasivoTipos[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clase])

  async function handleSave() {
    if (!nombre) return
    setSaving(true)
    try {
      const saldoNum = saldo.trim() === '' ? 0 : parseFloat(saldo.replace(',', '.'))
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
        metaObjetivo: metaObjVal ? parseFloat(metaObjVal.replace(',', '.')) : null,
        metaMoneda: metaObjVal ? metaMoneda : null,
        snapshots,
      }
      if (editing?.id) await updateAsset(editing.id, data)
      else              await addAsset(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    const borrada = editing
    setSaving(true)
    try {
      await deleteAsset(borrada.id!)
      onClose()
      offerUndo(`"${borrada.nombre}" eliminada`, () => restoreAsset(borrada))
    }
    finally { setSaving(false) }
  }

  const canSave = nombre.trim() && (saldo.trim() === '' || parseFloat(saldo.replace(',', '.')) >= 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
      bodyClassName="px-5 pb-4 space-y-5"
      footer={
        <>
          <div className="flex gap-2">
            {editing && (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleDelete}
                disabled={saving}
                className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl transition-colors bg-rose-500/10 text-rose-500 hover:bg-rose-500/15"
                title="Eliminar cuenta"
                aria-label="Eliminar cuenta"
              >
                <Trash2 size={17} />
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving || !canSave}
              className="flex-1 h-12 rounded-2xl bg-brand text-white text-sm font-bold shadow-soft disabled:opacity-40"
            >
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar cuenta'}
            </motion.button>
          </div>
        </>
      }
    >
      {/* Clase toggle */}
      <Segmented
        id="asset-clase"
        size="lg"
        value={clase}
        onChange={setClase}
        options={[
          { value: 'activo', label: 'Activo', activeColor: 'linear-gradient(135deg, #6e9e7b, #3f6b4b)' },
          { value: 'pasivo', label: 'Pasivo', activeColor: 'linear-gradient(135deg, #c86f5c, #9c4434)' },
        ]}
      />

      {/* Nombre */}
      <div>
        <FieldLabel>Nombre de la cuenta</FieldLabel>
        <input
          className={fieldClass}
          placeholder={clase === 'activo' ? 'Ej: Cuenta Bancolombia' : 'Ej: Tarjeta Visa'}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>

      {/* Tipo */}
      <div>
        <FieldLabel>Tipo</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {tiposActuales.map((t) => (
            <motion.button
              key={t}
              whileTap={{ scale: 0.92 }}
              onClick={() => setTipo(t)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
                tipo === t
                  ? 'bg-primary text-white shadow-[0_6px_14px_-6px_var(--primary)]'
                  : 'bg-gray-500/[0.08] text-gray-600 hover:bg-gray-500/[0.12]'
              }`}
            >
              {t}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Saldo + Moneda */}
      <div>
        <FieldLabel>Saldo actual</FieldLabel>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={saldo}
          onChange={(e) => setSaldo(e.target.value)}
          className={amountFieldClass}
        />
        <Segmented
          id="asset-moneda"
          size="sm"
          value={moneda}
          onChange={setMoneda}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          variant="solid"
          className="mt-2"
        />
      </div>

      {/* Fecha de alta */}
      <div>
        <FieldLabel>Fecha de alta</FieldLabel>
        <input type="date" className={fieldClass} value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} />
      </div>

      {/* Meta de ahorro (solo activos) */}
      <Collapse open={clase === 'activo'}>
        <div className="p-4 rounded-[20px] bg-primary/[0.06] ring-1 ring-primary/15">
          <p className="eyebrow !text-primary mb-2">Meta de ahorro (opcional)</p>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="0"
            value={metaObjVal}
            onChange={(e) => setMetaObjVal(e.target.value)}
            className={`${fieldClass} !bg-surface text-lg font-bold`}
          />
          <Segmented
            id="asset-meta-moneda"
            size="sm"
            value={metaMoneda}
            onChange={setMetaMoneda}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            variant="solid"
            className="mt-2"
          />
          {metaObjVal && (
            <p className="text-xs text-primary/80 mt-2">
              La meta se mostrará como barra de progreso en la cuenta
            </p>
          )}
        </div>
      </Collapse>
    </Sheet>
  )
}
