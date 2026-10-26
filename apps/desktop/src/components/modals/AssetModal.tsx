'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Label } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import Collapse from '@/components/ui/Collapse'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { addAsset, updateAsset, deleteAsset, restoreAsset } from '@finanzas/core/lib/assets'
import { offerUndo } from '@finanzas/core/lib/undo'
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
      description={editing ? `${editing.clase === 'activo' ? 'Activo' : 'Pasivo'} · ${editing.tipo}` : undefined}
      size="md"
    >
      <Form
        key={editing?.id ?? 'new'}
        editing={editing ?? null}
        onClose={onClose}
      />
    </Modal>
  )
}

const parseNum = (v: string) => parseFloat(v.replace(',', '.'))

function Form({ editing, onClose }: { editing: Asset | null; onClose: () => void }) {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const showToast = useUIStore((s) => s.showToast)

  const [nombre, setNombre]       = useState(editing?.nombre ?? '')
  const [clase, setClase]         = useState<'activo' | 'pasivo'>(editing?.clase ?? 'activo')
  const [tipo, setTipo]           = useState(editing?.tipo ?? settings.tiposActivo[0] ?? 'Banco')
  const [moneda, setMoneda]       = useState<Currency>(editing?.moneda ?? 'ARS')
  const [saldo, setSaldo]         = useState(editing ? String(editing.saldo) : '')
  const [fechaAlta, setFechaAlta] = useState(
    editing ? toLocalDateString(editing.fechaAlta.toDate()) : toLocalDateString(),
  )
  const [meta, setMeta]           = useState(editing?.metaObjetivo ? String(editing.metaObjetivo) : '')
  const [metaMoneda, setMetaMoneda] = useState<Currency>((editing?.metaMoneda as Currency) ?? 'USD')
  const [saving, setSaving]       = useState(false)

  const tiposDisponibles = clase === 'activo' ? settings.tiposActivo : settings.tiposPasivo

  function changeClase(c: 'activo' | 'pasivo') {
    setClase(c)
    const tipos = c === 'activo' ? settings.tiposActivo : settings.tiposPasivo
    if (!tipos.includes(tipo)) setTipo(tipos[0] ?? '')
  }

  const saldoNum = saldo.trim() === '' ? 0 : parseNum(saldo)
  const metaNum = meta.trim() === '' ? null : parseNum(meta)
  const invalid = !nombre.trim() || Number.isNaN(saldoNum) || (metaNum !== null && (Number.isNaN(metaNum) || metaNum <= 0))

  async function handleSave() {
    if (!nombre.trim()) return showToast('Ingresá un nombre', 'error')
    if (invalid) return showToast('Revisá los montos', 'error')
    const altaDate = new Date(fechaAlta + 'T12:00:00')
    const altaMonth = fechaAlta.slice(0, 7)
    // Antes se enviaba `snapshots: []` también al editar, lo que borraba todo
    // el historial de la cuenta. Ahora se conservan y, si no hay snapshot del
    // mes de alta, se crea uno con el saldo inicial (igual que mobile).
    const baseSnaps = editing?.snapshots ?? []
    const snapshots = baseSnaps.some((sn) => sn.month === altaMonth)
      ? baseSnaps
      : [...baseSnaps, { month: altaMonth, aporte: saldoNum, saldo: saldoNum }]
          .sort((a, b) => a.month.localeCompare(b.month))
    const payload: Omit<Asset, 'id'> = {
      userId: 'shared',
      nombre: nombre.trim(),
      clase,
      tipo,
      moneda,
      saldo: saldoNum,
      fechaAlta: { toDate: () => altaDate },
      metaObjetivo: clase === 'activo' ? metaNum : null,
      metaMoneda: clase === 'activo' && metaNum !== null ? metaMoneda : null,
      snapshots,
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

  // Sin confirm(): se borra y el toast permite deshacer (restaura mismo id + historial)
  async function handleDelete() {
    if (!editing?.id) return
    const borrada = editing
    setSaving(true)
    try {
      await deleteAsset(borrada.id!)
      onClose()
      offerUndo(`"${borrada.nombre}" eliminada`, () => restoreAsset(borrada))
    } catch {
      showToast('Error al eliminar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); handleSave() }}
    >
      <Segmented
        id="asset-clase"
        value={clase}
        onChange={changeClase}
        className="w-full"
        options={[
          { value: 'activo', label: 'Activo', activeColor: 'var(--income)' },
          { value: 'pasivo', label: 'Pasivo', activeColor: 'var(--expense)' },
        ]}
      />
      <div>
        <Label htmlFor="asset-nombre">Nombre</Label>
        <Input id="asset-nombre" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Banco Galicia" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="asset-tipo">Tipo</Label>
          <Select id="asset-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="asset-alta">Fecha de alta</Label>
          <Input id="asset-alta" type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="asset-saldo">Saldo actual</Label>
        <div className="flex gap-2">
          <Input
            id="asset-saldo"
            inputMode="decimal"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            placeholder="0"
            className="flex-1 text-base font-semibold tnum"
          />
          <Segmented
            id="asset-moneda"
            value={moneda}
            onChange={setMoneda}
            className="h-10 items-center"
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        {editing && (
          <p className="mt-1.5 text-[11px] text-muted-2">
            Para registrar el saldo de un mes (aporte y revalorización) usá “Actualizar saldo”.
          </p>
        )}
      </div>

      <Collapse open={clase === 'activo'}>
        <div className="border-t border-hairline pt-4">
          <Label htmlFor="asset-meta">Meta de ahorro (opcional)</Label>
          <div className="flex gap-2">
            <Input
              id="asset-meta"
              inputMode="decimal"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Objetivo"
              className="flex-1 tnum"
            />
            <Select value={metaMoneda} onChange={(e) => setMetaMoneda(e.target.value as Currency)} className="w-24" aria-label="Moneda de la meta">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>
      </Collapse>

      <div className="flex items-center justify-between gap-2 pt-4 border-t border-hairline">
        {editing ? (
          <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving} className="text-expense">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving || invalid}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </form>
  )
}
