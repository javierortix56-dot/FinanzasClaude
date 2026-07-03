'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { addAsset, updateAsset, deleteAsset } from '@finanzas/core/lib/assets'
import { DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import { Asset, Currency } from '@finanzas/core/types'
import { toLocalDateString } from '@finanzas/core/lib/constants'

const CURRENCIES: Currency[] = ['ARS', 'COP', 'USD']

export function AssetModal({
  open, onClose, editing,
}: { open: boolean; onClose: () => void; editing?: Asset | null }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Editar cuenta' : 'Nueva cuenta'}
      size="md"
    >
      {open && (
        <Form
          key={editing?.id ?? 'new'}
          editing={editing ?? null}
          onClose={onClose}
        />
      )}
    </Modal>
  )
}

function Form({ editing, onClose }: { editing: Asset | null; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)

  const [nombre, setNombre]       = useState(editing?.nombre ?? '')
  const [clase, setClase]         = useState<'activo' | 'pasivo'>(editing?.clase ?? 'activo')
  const [tipo, setTipo]           = useState(editing?.tipo ?? 'Banco')
  const [moneda, setMoneda]       = useState<Currency>(editing?.moneda ?? 'ARS')
  const [saldo, setSaldo]         = useState(editing ? String(editing.saldo) : '')
  const [fechaAlta, setFechaAlta] = useState(
    editing ? toLocalDateString(editing.fechaAlta.toDate()) : toLocalDateString(),
  )
  const [meta, setMeta]           = useState(editing?.metaObjetivo ? String(editing.metaObjetivo) : '')
  const [metaMoneda, setMetaMoneda] = useState<Currency>((editing?.metaMoneda as Currency) ?? 'USD')
  const [saving, setSaving]       = useState(false)

  const tiposDisponibles = clase === 'activo' ? settings.tiposActivo : settings.tiposPasivo

  async function handleSave() {
    if (!nombre.trim()) return showToast('Ingresá un nombre', 'error')
    const s = parseFloat(saldo || '0')
    const payload = {
      userId: 'shared',
      nombre: nombre.trim(),
      clase,
      tipo,
      moneda,
      saldo: s,
      fechaAlta: { toDate: () => new Date(fechaAlta + 'T12:00:00') },
      metaObjetivo: meta ? parseFloat(meta) : null,
      metaMoneda: meta ? metaMoneda : null,
      snapshots: [],
    }
    setSaving(true)
    try {
      if (editing?.id) await updateAsset(editing.id, payload)
      else await addAsset(payload)
      showToast(editing ? 'Cuenta actualizada' : 'Cuenta creada')
      onClose()
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editing?.id) return
    if (!confirm('¿Eliminar esta cuenta?')) return
    setSaving(true)
    try {
      await deleteAsset(editing.id)
      showToast('Cuenta eliminada')
      onClose()
    } catch {
      showToast('Error al eliminar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Nombre</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Banco Galicia" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Clase</Label>
          <Select value={clase} onChange={(e) => setClase(e.target.value as 'activo' | 'pasivo')}>
            <option value="activo">Activo</option>
            <option value="pasivo">Pasivo</option>
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label>Saldo</Label>
          <Input type="number" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </div>
      <div>
        <Label>Fecha de alta</Label>
        <Input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} />
      </div>
      {clase === 'activo' && (
        <div className="border-t border-border pt-4">
          <Label>Meta de ahorro (opcional)</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Objetivo" />
            </div>
            <Select value={metaMoneda} onChange={(e) => setMetaMoneda(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border -mx-6 px-6 -mb-5 pb-5 mt-5">
        {editing ? (
          <Button variant="ghost" onClick={handleDelete} disabled={saving}>
            <Trash2 className="h-4 w-4 text-expense" /><span className="text-expense">Eliminar</span>
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}
