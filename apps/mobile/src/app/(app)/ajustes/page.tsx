'use client'

import { useState, useRef } from 'react'
import {
  ChevronRight, Plus, Pencil, ChevronDown, ChevronUp,
  Copy, RotateCcw, Lock, Trash2, Check, Download, Upload, ChevronLeft,
} from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { updateSettings } from '@finanzas/core/lib/settings'
import {
  deleteMonthTransactions,
  cloneMonthTransactions,
  createRecurringTransactions,
  countMonthTransactions,
} from '@finanzas/core/lib/transactions'
import { exportBackup, downloadBackup, importBackup, parseBackupFile } from '@finanzas/core/lib/backup'
import { monthLabel, SHARED_USER_ID } from '@finanzas/core/lib/constants'
import dynamic from 'next/dynamic'
import { Category, CategoryGroup, AhorroLink } from '@finanzas/core/types'

const CategoryModal = dynamic(() => import('@/components/ajustes/CategoryModal'), { ssr: false })

type Section = 'cambio' | 'categorias' | 'categorias_ing' | 'tipos' | 'ahorro_links' | 'mes' | 'datos' | null

// ── Modal state types ─────────────────────────────────────────────────────────
type GroupModalState = {
  open: boolean
  tipo: 'gasto' | 'ingreso'
  group: CategoryGroup | null   // null = new group
}
type SubModalState = {
  open: boolean
  tipo: 'gasto' | 'ingreso'
  groupId: string
  category: Category | null     // null = new subcategory
}

export default function AjustesPage() {
  const { settings, setSettings } = useSettingsStore()
  const { currentMonth } = useTransactionStore()
  const { assets } = useAssetStore()
  const [openSection, setOpenSection] = useState<Section>(null)

  // Tipos de cambio
  const [arsRate, setArsRate] = useState(String(settings?.tipoCambio.ARS_USD ?? 1200))
  const [copRate, setCopRate] = useState(String(settings?.tipoCambio.COP_USD ?? 4100))
  const [savingRate, setSavingRate] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  // Category tree: expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Modal for top-level groups
  const [groupModal, setGroupModal] = useState<GroupModalState>({
    open: false, tipo: 'gasto', group: null,
  })

  // Modal for subcategories
  const [subModal, setSubModal] = useState<SubModalState>({
    open: false, tipo: 'gasto', groupId: '', category: null,
  })

  // Tipos list editing
  const [editingTipoActivo, setEditingTipoActivo] = useState(false)
  const [editingTipoPasivo, setEditingTipoPasivo] = useState(false)
  const [tiposActivo, setTiposActivo] = useState<string[]>(settings?.tiposActivo ?? [])
  const [tiposPasivo, setTiposPasivo] = useState<string[]>(settings?.tiposPasivo ?? [])
  const [newTipoActivo, setNewTipoActivo] = useState('')
  const [newTipoPasivo, setNewTipoPasivo] = useState('')

  // Mes actions
  const [mesAction, setMesAction] = useState<string | null>(null)
  const [mesResult, setMesResult] = useState<string | null>(null)
  const [mesError, setMesError] = useState<string | null>(null)
  const [deleteMonthConfirm, setDeleteMonthConfirm] = useState(false)
  // Confirmaciones cuando el mes destino ya tiene movimientos
  const [clonarConfirm, setClonarConfirm] = useState<{ existing: number; next: string } | null>(null)
  const [recurrentesConfirm, setRecurrentesConfirm] = useState<{ existing: number; next: string } | null>(null)

  // Import/Export
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [backupAction, setBackupAction] = useState<string | null>(null)
  const [backupResult, setBackupResult] = useState<string | null>(null)

  // Ahorro links
  const [newLinkCatId, setNewLinkCatId] = useState('')
  const [newLinkAssetId, setNewLinkAssetId] = useState('')

  if (!settings) {
    return (
      <div className="flex flex-col h-full bg-gray-50">
        <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
          <h1 className="text-gray-800 font-bold text-xl">Ajustes</h1>
          <p className="text-gray-400 text-xs mt-0.5">Javier &amp; Mary</p>
        </div>
        <div className="flex items-center justify-center flex-1">
          <div className="w-6 h-6 border-2 border-[#534AB7] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  const s = settings  // narrowed to Settings (non-null) after guard above

  function toggle(section: Section) {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Tipos de cambio ──────────────────────────────────────────────────────────
  async function saveRates() {
    setRateError(null)
    const ARS_USD = parseFloat(arsRate.replace(',', '.'))
    const COP_USD = parseFloat(copRate.replace(',', '.'))
    if (!Number.isFinite(ARS_USD) || !Number.isFinite(COP_USD) || ARS_USD <= 0 || COP_USD <= 0) {
      setRateError('Los tipos de cambio deben ser números mayores a 0')
      return
    }
    setSavingRate(true)
    try {
      const updated = { ...s, tipoCambio: { ARS_USD, COP_USD } }
      await updateSettings(SHARED_USER_ID, { tipoCambio: { ARS_USD, COP_USD } })
      setSettings(updated)
      setRateSaved(true)
      setTimeout(() => setRateSaved(false), 2000)
    } catch (err) {
      setRateError('Error al guardar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSavingRate(false)
    }
  }

  // ── CRUD Grupos ──────────────────────────────────────────────────────────────
  async function handleSaveGroup(cat: Category, tipo: 'gasto' | 'ingreso') {
    const key  = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    const list = [...(tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso)]
    const idx  = list.findIndex((g) => g.id === cat.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], nombre: cat.nombre, color: cat.color, activa: cat.activa }
    } else {
      list.push({ id: cat.id, nombre: cat.nombre, color: cat.color, activa: cat.activa, subcategorias: [] })
    }
    const partial = { [key]: list }
    await updateSettings(SHARED_USER_ID, partial)
    setSettings({ ...s, ...partial })
    setGroupModal((prev) => ({ ...prev, open: false, group: null }))
  }

  async function handleDeleteGroup(id: string, tipo: 'gasto' | 'ingreso') {
    const key  = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    const list = (tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso).filter((g) => g.id !== id)
    const partial = { [key]: list }
    await updateSettings(SHARED_USER_ID, partial)
    setSettings({ ...s, ...partial })
    setGroupModal((prev) => ({ ...prev, open: false, group: null }))
  }

  // ── CRUD Subcategorías ───────────────────────────────────────────────────────
  async function handleSaveSubcat(cat: Category, tipo: 'gasto' | 'ingreso', groupId: string) {
    const key  = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    const list = (tipo === 'gasto' ? [...s.categoriasGasto] : [...s.categoriasIngreso])
    const gIdx = list.findIndex((g) => g.id === groupId)
    if (gIdx < 0) return
    const subs = [...list[gIdx].subcategorias]
    const sIdx = subs.findIndex((c) => c.id === cat.id)
    if (sIdx >= 0) subs[sIdx] = cat
    else subs.push(cat)
    list[gIdx] = { ...list[gIdx], subcategorias: subs }
    const partial = { [key]: list }
    await updateSettings(SHARED_USER_ID, partial)
    setSettings({ ...s, ...partial })
    setSubModal((prev) => ({ ...prev, open: false, category: null }))
  }

  async function handleDeleteSubcat(id: string, tipo: 'gasto' | 'ingreso', groupId: string) {
    const key  = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    const list = (tipo === 'gasto' ? [...s.categoriasGasto] : [...s.categoriasIngreso])
    const gIdx = list.findIndex((g) => g.id === groupId)
    if (gIdx < 0) return
    list[gIdx] = { ...list[gIdx], subcategorias: list[gIdx].subcategorias.filter((c) => c.id !== id) }
    const partial = { [key]: list }
    await updateSettings(SHARED_USER_ID, partial)
    setSettings({ ...s, ...partial })
    setSubModal((prev) => ({ ...prev, open: false, category: null }))
  }

  // ── Tipos activo/pasivo ──────────────────────────────────────────────────────
  async function saveTiposActivo() {
    const filtered = tiposActivo.filter(Boolean)
    await updateSettings(SHARED_USER_ID, { tiposActivo: filtered })
    setSettings({ ...s, tiposActivo: filtered })
    setEditingTipoActivo(false)
  }

  async function saveTiposPasivo() {
    const filtered = tiposPasivo.filter(Boolean)
    await updateSettings(SHARED_USER_ID, { tiposPasivo: filtered })
    setSettings({ ...s, tiposPasivo: filtered })
    setEditingTipoPasivo(false)
  }

  // ── Acciones de mes ──────────────────────────────────────────────────────────
  function resetMesFeedback() {
    setMesResult(null)
    setMesError(null)
  }

  async function handleCerrarMes() {
    resetMesFeedback()
    setMesAction('cerrando')
    try {
      const { ARS_USD, COP_USD } = s.tipoCambio
      const hist    = [...(s.historialTipoCambio ?? []).filter((h) => h.mes !== currentMonth), { mes: currentMonth, ARS_USD, COP_USD }]
      const cerrados = [...(s.mesesCerrados ?? []).filter((m) => m !== currentMonth), currentMonth]
      await updateSettings(SHARED_USER_ID, { historialTipoCambio: hist, mesesCerrados: cerrados })
      setSettings({ ...s, historialTipoCambio: hist, mesesCerrados: cerrados })
      setMesResult(`Mes ${monthLabel(currentMonth)} cerrado. Tipo de cambio guardado.`)
    } catch (err) {
      setMesError('Error al cerrar mes: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setMesAction(null) }
  }

  async function handleClonarMes() {
    resetMesFeedback()
    const { shiftMonth } = await import('@finanzas/core/lib/constants')
    const nextMonth = shiftMonth(currentMonth, 1)
    // Si aún no confirmó y el mes destino ya tiene movimientos, pedimos confirmación primero
    if (!clonarConfirm) {
      setMesAction('clonando')
      try {
        const existing = await countMonthTransactions(nextMonth)
        if (existing > 0) {
          setClonarConfirm({ existing, next: nextMonth })
          return
        }
      } catch (err) {
        setMesError('Error verificando mes destino: ' + (err instanceof Error ? err.message : String(err)))
        return
      } finally { setMesAction(null) }
    }
    setMesAction('clonando')
    try {
      const count = await cloneMonthTransactions(currentMonth, nextMonth)
      setMesResult(`${count} movimiento(s) clonados a ${monthLabel(nextMonth)}.`)
      setClonarConfirm(null)
    } catch (err) {
      setMesError('Error al clonar mes: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setMesAction(null) }
  }

  async function handleCrearRecurrentes() {
    resetMesFeedback()
    const { shiftMonth } = await import('@finanzas/core/lib/constants')
    const nextMonth = shiftMonth(currentMonth, 1)
    if (!recurrentesConfirm) {
      setMesAction('creando')
      try {
        const existing = await countMonthTransactions(nextMonth)
        if (existing > 0) {
          setRecurrentesConfirm({ existing, next: nextMonth })
          return
        }
      } catch (err) {
        setMesError('Error verificando mes destino: ' + (err instanceof Error ? err.message : String(err)))
        return
      } finally { setMesAction(null) }
    }
    setMesAction('creando')
    try {
      const count = await createRecurringTransactions(nextMonth)
      setMesResult(`${count} movimiento(s) recurrente(s) creados en ${monthLabel(nextMonth)}.`)
      setRecurrentesConfirm(null)
    } catch (err) {
      setMesError('Error al crear recurrentes: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setMesAction(null) }
  }

  async function handleBorrarMes() {
    if (!deleteMonthConfirm) { setDeleteMonthConfirm(true); return }
    resetMesFeedback()
    setMesAction('borrando')
    try {
      const count = await deleteMonthTransactions(currentMonth)
      setMesResult(`${count} movimiento(s) eliminados de ${monthLabel(currentMonth)}.`)
      setDeleteMonthConfirm(false)
    } catch (err) {
      setMesError('Error al borrar mes: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setMesAction(null) }
  }

  const isClosed = s?.mesesCerrados?.includes(currentMonth)

  // ── Export/Import ────────────────────────────────────────────────────────────
  async function handleExport() {
    setBackupAction('exportando')
    try {
      const data = await exportBackup(SHARED_USER_ID)
      downloadBackup(data)
      setBackupResult(`Backup exportado: ${data.transactions.length} movimientos, ${data.assets.length} activos.`)
    } catch (e) {
      setBackupResult('Error al exportar: ' + String(e))
    } finally { setBackupAction(null) }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBackupAction('importando')
    try {
      const data   = await parseBackupFile(file)
      const result = await importBackup(SHARED_USER_ID, data)
      setBackupResult(`Importados: ${result.transactions} movimientos, ${result.assets} activos.`)
    } catch (err) {
      setBackupResult('Error: ' + String(err))
    } finally {
      setBackupAction(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Category tree helper ─────────────────────────────────────────────────────
  function CategoryTree({ tipo }: { tipo: 'gasto' | 'ingreso' }) {
    const groups = tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso
    return (
      <div className="space-y-1 pt-2">
        {/* Botón nuevo grupo */}
        <button
          onClick={() => setGroupModal({ open: true, tipo, group: null })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[#534AB7]/30 text-[#534AB7] text-xs font-semibold hover:bg-[#534AB7]/5 transition-colors"
        >
          <Plus size={13} /> Nueva categoría padre
        </button>

        {groups.map((group) => {
          const isOpen = expandedGroups.has(group.id)
          return (
            <div key={group.id} className="rounded-xl border border-gray-100 overflow-hidden">
              {/* Header del grupo */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.color }} />
                  <span className={`text-sm font-semibold truncate ${!group.activa ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {group.nombre}
                  </span>
                  <span className="text-[10px] text-gray-400 ml-1">({group.subcategorias.length})</span>
                  {isOpen
                    ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0 ml-auto" />
                    : <ChevronLeft size={13} className="text-gray-400 flex-shrink-0 ml-auto rotate-180" />
                  }
                </button>

                {/* Acciones grupo */}
                <button
                  onClick={() => setSubModal({ open: true, tipo, groupId: group.id, category: null })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-[#534AB7] flex-shrink-0"
                  title="Nueva subcategoría"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => setGroupModal({ open: true, tipo, group })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"
                  title="Editar grupo"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id, tipo)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 flex-shrink-0"
                  title="Eliminar grupo"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Subcategorías expandibles */}
              {isOpen && (
                <div className="border-t border-gray-50 bg-gray-50/60 divide-y divide-gray-50">
                  {group.subcategorias.length === 0 ? (
                    <p className="text-xs text-gray-400 px-5 py-2.5 italic">Sin subcategorías</p>
                  ) : (
                    group.subcategorias.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2 px-5 py-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sub.color }} />
                        <span className={`flex-1 text-xs truncate ${!sub.activa ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {sub.nombre}
                        </span>
                        <button
                          onClick={() => setSubModal({ open: true, tipo, groupId: group.id, category: sub })}
                          className="p-1 rounded hover:bg-gray-200 text-gray-400"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteSubcat(sub.id, tipo, group.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-400"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 pt-10 pb-4 shadow-sm">
        <h1 className="text-gray-800 font-bold text-xl">Ajustes</h1>
        <p className="text-gray-400 text-xs mt-0.5">Javier &amp; Mary</p>
      </div>

      {/* Card */}
      <div className="flex-1 bg-white overflow-y-auto">
        <div className="px-4 pt-4 pb-24 space-y-1">

          {/* ── Tipos de cambio ── */}
          <Section
            label="Tipos de cambio"
            open={openSection === 'cambio'}
            onToggle={() => { toggle('cambio'); setArsRate(String(s?.tipoCambio.ARS_USD ?? 1200)); setCopRate(String(s?.tipoCambio.COP_USD ?? 4100)) }}
          >
            <div className="space-y-3 pt-2">
              <RateInput label="1 USD = ? ARS" value={arsRate} onChange={setArsRate} />
              <RateInput label="1 USD = ? COP" value={copRate} onChange={setCopRate} />
              <button
                onClick={saveRates}
                disabled={savingRate}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  rateSaved ? 'bg-green-500 text-white' : 'bg-[#534AB7] text-white'
                }`}
              >
                {rateSaved ? <><Check size={14} /> Guardado</> : savingRate ? 'Guardando...' : 'Actualizar tipo de cambio'}
              </button>
              {rateError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-400 font-medium">
                  {rateError}
                </div>
              )}
              {(s?.historialTipoCambio ?? []).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Historial</p>
                  {[...(s?.historialTipoCambio ?? [])].reverse().slice(0, 6).map((h) => (
                    <div key={h.mes} className="flex justify-between text-xs text-gray-500 py-1 border-b border-gray-50">
                      <span className="capitalize">{monthLabel(h.mes)}</span>
                      <span>ARS {h.ARS_USD} · COP {h.COP_USD}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Categorías de Gasto ── */}
          <Section
            label="Categorías de Gasto"
            open={openSection === 'categorias'}
            onToggle={() => toggle('categorias')}
          >
            <CategoryTree tipo="gasto" />
          </Section>

          {/* ── Categorías de Ingreso ── */}
          <Section
            label="Categorías de Ingreso"
            open={openSection === 'categorias_ing'}
            onToggle={() => toggle('categorias_ing')}
          >
            <CategoryTree tipo="ingreso" />
          </Section>

          {/* ── Tipos de activo/pasivo ── */}
          <Section
            label="Tipos de activo / pasivo"
            open={openSection === 'tipos'}
            onToggle={() => { toggle('tipos'); setTiposActivo(s?.tiposActivo ?? []); setTiposPasivo(s?.tiposPasivo ?? []) }}
          >
            <div className="space-y-4 pt-2">
              {/* Activos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activos</p>
                  {editingTipoActivo
                    ? <button onClick={saveTiposActivo} className="text-xs text-[#534AB7] font-semibold">Guardar</button>
                    : <button onClick={() => setEditingTipoActivo(true)} className="text-xs text-[#534AB7] font-semibold flex items-center gap-1"><Pencil size={11} /> Editar</button>
                  }
                </div>
                {editingTipoActivo ? (
                  <div className="space-y-1.5">
                    {tiposActivo.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={t} onChange={(e) => { const c = [...tiposActivo]; c[i] = e.target.value; setTiposActivo(c) }}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                        <button onClick={() => setTiposActivo(tiposActivo.filter((_, j) => j !== i))} className="text-red-400 p-1.5"><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newTipoActivo} onChange={(e) => setNewTipoActivo(e.target.value)} placeholder="Nuevo tipo..."
                        className="flex-1 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTipoActivo.trim()) { setTiposActivo((p) => [...p, newTipoActivo.trim()]); setNewTipoActivo('') } }} />
                      <button onClick={() => { if (newTipoActivo.trim()) { setTiposActivo((p) => [...p, newTipoActivo.trim()]); setNewTipoActivo('') } }} className="px-3 text-[#534AB7] font-semibold text-sm"><Plus size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tiposActivo.map((t) => <span key={t} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{t}</span>)}
                  </div>
                )}
              </div>
              {/* Pasivos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pasivos</p>
                  {editingTipoPasivo
                    ? <button onClick={saveTiposPasivo} className="text-xs text-[#534AB7] font-semibold">Guardar</button>
                    : <button onClick={() => setEditingTipoPasivo(true)} className="text-xs text-[#534AB7] font-semibold flex items-center gap-1"><Pencil size={11} /> Editar</button>
                  }
                </div>
                {editingTipoPasivo ? (
                  <div className="space-y-1.5">
                    {tiposPasivo.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={t} onChange={(e) => { const c = [...tiposPasivo]; c[i] = e.target.value; setTiposPasivo(c) }}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
                        <button onClick={() => setTiposPasivo(tiposPasivo.filter((_, j) => j !== i))} className="text-red-400 p-1.5"><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newTipoPasivo} onChange={(e) => setNewTipoPasivo(e.target.value)} placeholder="Nuevo tipo..."
                        className="flex-1 border border-dashed border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTipoPasivo.trim()) { setTiposPasivo((p) => [...p, newTipoPasivo.trim()]); setNewTipoPasivo('') } }} />
                      <button onClick={() => { if (newTipoPasivo.trim()) { setTiposPasivo((p) => [...p, newTipoPasivo.trim()]); setNewTipoPasivo('') } }} className="px-3 text-[#534AB7] font-semibold text-sm"><Plus size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tiposPasivo.map((t) => <span key={t} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Vínculos de ahorro ── */}
          <Section
            label="Vínculos de ahorro"
            open={openSection === 'ahorro_links'}
            onToggle={() => { toggle('ahorro_links'); setNewLinkCatId(''); setNewLinkAssetId('') }}
          >
            {(() => {
              const ahorroLinks: AhorroLink[] = s.ahorroLinks ?? []
              const activoAssets = assets.filter((a) => a.clase === 'activo')

              // Flatten all gasto categories
              const flatCats: { id: string; label: string }[] = []
              for (const group of s.categoriasGasto) {
                if (group.subcategorias.length === 0) {
                  flatCats.push({ id: group.id, label: group.nombre })
                } else {
                  flatCats.push({ id: group.id, label: group.nombre })
                  for (const sub of group.subcategorias) {
                    flatCats.push({ id: sub.id, label: `${group.nombre} / ${sub.nombre}` })
                  }
                }
              }

              async function addLink() {
                if (!newLinkCatId || !newLinkAssetId) return
                const already = ahorroLinks.some((l) => l.categoriaId === newLinkCatId)
                if (already) return
                const newList: AhorroLink[] = [...ahorroLinks, { categoriaId: newLinkCatId, assetId: newLinkAssetId }]
                await updateSettings(SHARED_USER_ID, { ahorroLinks: newList })
                setSettings({ ...s, ahorroLinks: newList })
                setNewLinkCatId('')
                setNewLinkAssetId('')
              }

              async function removeLink(catId: string) {
                const newList = ahorroLinks.filter((l) => l.categoriaId !== catId)
                await updateSettings(SHARED_USER_ID, { ahorroLinks: newList })
                setSettings({ ...s, ahorroLinks: newList })
              }

              return (
                <div className="space-y-3 pt-2">
                  {ahorroLinks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin vínculos configurados</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ahorroLinks.map((link) => {
                        const cat = flatCats.find((c) => c.id === link.categoriaId)
                        const asset = assets.find((a) => a.id === link.assetId)
                        return (
                          <div key={link.categoriaId} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="flex-1 text-xs text-gray-700 truncate">
                              {cat?.label ?? link.categoriaId} <span className="text-gray-400">→</span> {asset?.nombre ?? link.assetId}
                            </span>
                            <button onClick={() => removeLink(link.categoriaId)} className="p-1 rounded hover:bg-red-50 text-red-400 flex-shrink-0">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={newLinkCatId}
                      onChange={(e) => setNewLinkCatId(e.target.value)}
                      className="flex-1 min-w-0 h-9 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30"
                    >
                      <option value="">Categoría...</option>
                      {flatCats.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={newLinkAssetId}
                      onChange={(e) => setNewLinkAssetId(e.target.value)}
                      className="flex-1 min-w-0 h-9 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#534AB7]/30"
                    >
                      <option value="">Activo...</option>
                      {activoAssets.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    <button
                      onClick={addLink}
                      disabled={!newLinkCatId || !newLinkAssetId}
                      className="h-9 px-3 rounded-xl bg-[#534AB7] text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                </div>
              )
            })()}
          </Section>

          {/* ── Acciones del mes ── */}
          <Section
            label={`Acciones — ${monthLabel(currentMonth)}`}
            open={openSection === 'mes'}
            onToggle={() => {
              toggle('mes')
              resetMesFeedback()
              setDeleteMonthConfirm(false)
              setClonarConfirm(null)
              setRecurrentesConfirm(null)
            }}
          >
            <div className="space-y-2 pt-2">
              {isClosed && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <Lock size={13} className="text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">Mes cerrado — tipo de cambio guardado</p>
                </div>
              )}
              <ActionButton icon={<Lock size={14} />} label="Cerrar mes" sublabel="Guarda el tipo de cambio actual en el historial" onClick={handleCerrarMes} loading={mesAction === 'cerrando'} color="purple" />
              <ActionButton
                icon={<Copy size={14} />}
                label={clonarConfirm ? '¿Clonar igual? (duplicados)' : 'Clonar mes al siguiente'}
                sublabel={clonarConfirm
                  ? `${monthLabel(clonarConfirm.next)} ya tiene ${clonarConfirm.existing} movimiento(s). Tocá de nuevo para confirmar.`
                  : 'Copia todos los movimientos al mes siguiente'}
                onClick={handleClonarMes}
                loading={mesAction === 'clonando'}
                color={clonarConfirm ? 'red' : 'blue'}
              />
              <ActionButton
                icon={<RotateCcw size={14} />}
                label={recurrentesConfirm ? '¿Crear igual? (duplicados)' : 'Crear recurrentes'}
                sublabel={recurrentesConfirm
                  ? `${monthLabel(recurrentesConfirm.next)} ya tiene ${recurrentesConfirm.existing} movimiento(s). Tocá de nuevo para confirmar.`
                  : 'Crea movimientos recurrentes en el mes siguiente'}
                onClick={handleCrearRecurrentes}
                loading={mesAction === 'creando'}
                color={recurrentesConfirm ? 'red' : 'green'}
              />
              <ActionButton icon={<Trash2 size={14} />} label={deleteMonthConfirm ? '¿Confirmar borrado?' : 'Borrar mes'} sublabel="Elimina todos los movimientos del mes actual" onClick={handleBorrarMes} loading={mesAction === 'borrando'} color="red" danger />
              {mesResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-xs text-green-700 font-medium">
                  ✓ {mesResult}
                </div>
              )}
              {mesError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-400 font-medium">
                  ✗ {mesError}
                </div>
              )}
            </div>
          </Section>

          {/* ── Importar / Exportar ── */}
          <Section
            label="Importar / Exportar"
            open={openSection === 'datos'}
            onToggle={() => { toggle('datos'); setBackupResult(null) }}
          >
            <div className="space-y-2 pt-2">
              <ActionButton icon={<Download size={14} />} label="Exportar backup" sublabel="Descarga todos tus datos como archivo JSON" onClick={handleExport} loading={backupAction === 'exportando'} color="blue" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!backupAction}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-green-200 bg-green-50 text-green-600 text-left transition-all"
              >
                <Upload size={14} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{backupAction === 'importando' ? 'Importando...' : 'Importar backup'}</p>
                  <p className="text-[10px] opacity-70 mt-0.5">Restaura desde un archivo JSON exportado</p>
                </div>
                <ChevronRight size={13} className="opacity-40 flex-shrink-0" />
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              {backupResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700 font-medium">
                  {backupResult}
                </div>
              )}
            </div>
          </Section>

        </div>
      </div>

      {/* ── Modal grupo ── */}
      <CategoryModal
        open={groupModal.open}
        category={groupModal.group ? { id: groupModal.group.id, nombre: groupModal.group.nombre, color: groupModal.group.color, activa: groupModal.group.activa } : null}
        onClose={() => setGroupModal({ open: false, tipo: 'gasto', group: null })}
        onSave={(cat) => handleSaveGroup(cat, groupModal.tipo)}
        onDelete={groupModal.group ? (id) => handleDeleteGroup(id, groupModal.tipo) : undefined}
        title={groupModal.group ? 'Editar categoría padre' : 'Nueva categoría padre'}
      />

      {/* ── Modal subcategoría ── */}
      <CategoryModal
        open={subModal.open}
        category={subModal.category}
        onClose={() => setSubModal({ open: false, tipo: 'gasto', groupId: '', category: null })}
        onSave={(cat) => handleSaveSubcat(cat, subModal.tipo, subModal.groupId)}
        onDelete={subModal.category ? (id) => handleDeleteSubcat(id, subModal.tipo, subModal.groupId) : undefined}
        title={subModal.category ? 'Editar subcategoría' : 'Nueva subcategoría'}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-4 bg-white text-left">
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 bg-white border-t border-gray-50">{children}</div>}
    </div>
  )
}

function RateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-gray-600 flex-1">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#534AB7]" />
    </div>
  )
}

function ActionButton({ icon, label, sublabel, onClick, loading, color, danger }: {
  icon: React.ReactNode; label: string; sublabel: string; onClick: () => void; loading: boolean; color: 'purple' | 'blue' | 'green' | 'red'; danger?: boolean
}) {
  const colorMap = {
    purple: 'text-[#534AB7] bg-[#534AB7]/5 border-[#534AB7]/20',
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    green: 'text-green-600 bg-green-50 border-green-200',
    red: 'text-red-400 bg-red-50 border-red-200',
  }
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${colorMap[color]} ${loading ? 'opacity-50' : ''} ${danger ? 'ring-1 ring-red-300' : ''}`}>
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{loading ? 'Procesando...' : label}</p>
        <p className="text-[10px] opacity-70 mt-0.5 leading-tight">{sublabel}</p>
      </div>
      <ChevronRight size={13} className="opacity-40 flex-shrink-0" />
    </button>
  )
}
