'use client'

import { useState, useRef } from 'react'
import {
  ChevronRight, ChevronLeft, Plus, Pencil,
  Copy, RotateCcw, Lock, Trash2, Check, Download, Upload, LogOut,
  UserRound, Bell, ArrowLeftRight, Tags, Coins, Layers, PiggyBank, CalendarCog, DatabaseBackup,
  Palette, Sparkles, RefreshCw, Bug, CreditCard,
} from 'lucide-react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import PageHeader from '@/components/ui/PageHeader'
import Segmented from '@/components/ui/Segmented'
import { springSoft } from '@/components/ui/motion'
import CategoryTree from '@/components/ajustes/CategoryTree'
import TarjetasAjustes from '@/components/ajustes/TarjetasAjustes'
import { offerUndo } from '@/lib/undo'
import { getThemePref, setThemePref, ThemePref } from '@/lib/theme'
import { openOnboarding } from '@/lib/onboarding'
import { useTransactionStore as txStore } from '@finanzas/core/store/useTransactionStore'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { useAssetStore } from '@finanzas/core/store/useAssetStore'
import { useAuthStore } from '@finanzas/core/store/useAuthStore'
import { signOut } from '@finanzas/core/lib/auth'
import { pushSoportado, getSuscripcionActual, activarPush, desactivarPush } from '@finanzas/core/lib/push'
import { updateSettings } from '@finanzas/core/lib/settings'
import { cambiarFuenteCambio, syncCotizaciones, mensajeSync, ResultadoSync, haceCuanto, FUENTES_CAMBIO } from '@finanzas/core/lib/cotizaciones'
import {
  deleteMonthTransactions,
  restoreTransactions,
  cloneMonthTransactions,
  createRecurringTransactions,
  countMonthTransactions,
} from '@finanzas/core/lib/transactions'
import { exportBackup, downloadBackup, importBackup, parseBackupFile } from '@finanzas/core/lib/backup'
import { monthLabel, SHARED_USER_ID } from '@finanzas/core/lib/constants'
import dynamic from 'next/dynamic'
import { Category, CategoryGroup, AhorroLink, Currency, FuenteCambio, Settings } from '@finanzas/core/types'
import { HORMIGA_DEFAULT } from '@finanzas/core/lib/resumenAnalisis'

const CategoryModal = dynamic(() => import('@/components/ajustes/CategoryModal'), { ssr: false })

type Section = 'cuenta' | 'apariencia' | 'notif' | 'cambio' | 'hormiga' | 'tarjetas' | 'categorias' | 'categorias_ing' | 'tipos' | 'ahorro_links' | 'mes' | 'datos' | null

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
  const { user, monedaBase, setMonedaBase } = useAuthStore()
  const [openSection, setOpenSection] = useState<Section>(null)

  // Cuenta / sesión
  const [signingOut, setSigningOut] = useState(false)
  const [savingMoneda, setSavingMoneda] = useState(false)

  // Notificaciones push
  const [pushEstado, setPushEstado] = useState<'cargando' | 'activo' | 'inactivo' | 'no-soportado'>('cargando')
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)

  // Tipos de cambio
  const [arsRate, setArsRate] = useState(String(settings?.tipoCambio.ARS_USD ?? 1200))
  const [copRate, setCopRate] = useState(String(settings?.tipoCambio.COP_USD ?? 4100))
  const [savingRate, setSavingRate] = useState(false)
  const [rateSaved, setRateSaved] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)
  const [rateWarning, setRateWarning] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  // Apariencia (por dispositivo)
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref())

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
      <div className="flex flex-col h-full">
        <PageHeader title="Ajustes" subtitle="Javier & Mary" />
        <div className="px-4 space-y-2">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-[20px]" />)}
        </div>
      </div>
    )
  }

  const s = settings  // narrowed to Settings (non-null) after guard above

  function toggle(section: Section) {
    setOpenSection((prev) => (prev === section ? null : section))
  }

  function changeTheme(t: ThemePref) {
    setTheme(t)
    setThemePref(t)
  }

  // ── Tipos de cambio ──────────────────────────────────────────────────────────
  // Un éxito no muestra nada (los valores nuevos ya se ven); solo se avisa si
  // una moneda o las dos no respondieron.
  function mostrarResultado(r: ResultadoSync) {
    const m = mensajeSync(r)
    if (m?.tipo === 'warning') setRateWarning(m.texto)
    else if (m?.tipo === 'error') setRateError(m.texto)
  }

  async function handleFuente(f: FuenteCambio) {
    if (!settings) return
    setRateError(null)
    setRateWarning(null)
    setSyncing(true)
    try {
      mostrarResultado(await cambiarFuenteCambio(settings, f))
    } catch (err) {
      setRateError('No se pudo actualizar: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncAhora() {
    if (!settings) return
    setRateError(null)
    setRateWarning(null)
    setSyncing(true)
    try {
      mostrarResultado(await syncCotizaciones(settings, { force: true }))
    } finally {
      setSyncing(false)
    }
  }

  async function saveRates() {
    setRateError(null)
    setRateWarning(null)
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
      list[idx] = { ...list[idx], nombre: cat.nombre, color: cat.color, activa: cat.activa, icono: cat.icono }
    } else {
      list.push({ id: cat.id, nombre: cat.nombre, color: cat.color, activa: cat.activa, icono: cat.icono, subcategorias: [] })
    }
    const partial = { [key]: list }
    await updateSettings(SHARED_USER_ID, partial)
    setSettings({ ...s, ...partial })
    setGroupModal((prev) => ({ ...prev, open: false }))
  }

  // Guarda una lista de grupos y ofrece "Deshacer" restaurando la anterior
  async function saveGroupsWithUndo(tipo: 'gasto' | 'ingreso', list: CategoryGroup[], message: string) {
    const key  = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    const prev = tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso
    await updateSettings(SHARED_USER_ID, { [key]: list })
    setSettings({ ...s, [key]: list })
    offerUndo(message, async () => {
      await updateSettings(SHARED_USER_ID, { [key]: prev })
      const actual = useSettingsStore.getState().settings ?? s
      setSettings({ ...actual, [key]: prev })
    })
  }

  async function handleDeleteGroup(id: string, tipo: 'gasto' | 'ingreso') {
    const groups = tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso
    const nombre = groups.find((g) => g.id === id)?.nombre ?? 'Categoría'
    setGroupModal((prev) => ({ ...prev, open: false }))
    await saveGroupsWithUndo(tipo, groups.filter((g) => g.id !== id), `"${nombre}" eliminada`)
  }

  // Orden nuevo desde el árbol (arrastrar y soltar)
  async function handleReorder(tipo: 'gasto' | 'ingreso', list: CategoryGroup[]) {
    const key = tipo === 'gasto' ? 'categoriasGasto' : 'categoriasIngreso'
    setSettings({ ...s, [key]: list })
    try {
      await updateSettings(SHARED_USER_ID, { [key]: list })
    } catch (err) {
      console.error('[ajustes] reorder error:', err)
    }
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
    setSubModal((prev) => ({ ...prev, open: false }))
  }

  async function handleDeleteSubcat(id: string, tipo: 'gasto' | 'ingreso', groupId: string) {
    const list = (tipo === 'gasto' ? [...s.categoriasGasto] : [...s.categoriasIngreso])
    const gIdx = list.findIndex((g) => g.id === groupId)
    if (gIdx < 0) return
    const nombre = list[gIdx].subcategorias.find((c) => c.id === id)?.nombre ?? 'Subcategoría'
    list[gIdx] = { ...list[gIdx], subcategorias: list[gIdx].subcategorias.filter((c) => c.id !== id) }
    setSubModal((prev) => ({ ...prev, open: false }))
    await saveGroupsWithUndo(tipo, list, `"${nombre}" eliminada`)
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
    resetMesFeedback()
    setMesAction('borrando')
    // Se guardan los movimientos visibles del mes para poder restaurarlos
    const previos = txStore.getState().currentMonth === currentMonth ? txStore.getState().transactions : []
    try {
      const count = await deleteMonthTransactions(currentMonth)
      setMesResult(`${count} movimiento(s) eliminados de ${monthLabel(currentMonth)}.`)
      if (previos.length > 0) {
        offerUndo(`${count} movimiento${count !== 1 ? 's' : ''} eliminado${count !== 1 ? 's' : ''}`, () => restoreTransactions(previos))
      }
    } catch (err) {
      setMesError('Error al borrar mes: ' + (err instanceof Error ? err.message : String(err)))
    } finally { setMesAction(null) }
  }

  const isClosed = s?.mesesCerrados?.includes(currentMonth)

  // ── Cuenta / sesión ──────────────────────────────────────────────────────────
  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      // AuthProvider desmonta la app y muestra el login al detectar el cambio
    } catch (err) {
      console.error('[ajustes] signOut error:', err)
      setSigningOut(false)
    }
  }

  // ── Notificaciones push ──────────────────────────────────────────────────────
  async function checkPushEstado() {
    if (!pushSoportado()) { setPushEstado('no-soportado'); return }
    try {
      const sub = await getSuscripcionActual()
      setPushEstado(sub ? 'activo' : 'inactivo')
    } catch {
      setPushEstado('inactivo')
    }
  }

  async function handleTogglePush() {
    if (pushBusy) return
    setPushBusy(true)
    setPushError(null)
    try {
      if (pushEstado === 'activo') {
        await desactivarPush()
        setPushEstado('inactivo')
      } else {
        const err = await activarPush(user?.nombre || user?.email || 'shared')
        if (err) setPushError(err)
        else setPushEstado('activo')
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleMonedaBase(m: Currency) {
    if (m === monedaBase || savingMoneda) return
    setSavingMoneda(true)
    const prev = monedaBase
    setMonedaBase(m)  // la UI cambia al instante
    try {
      await updateSettings(SHARED_USER_ID, { monedaBase: m })
      setSettings({ ...s, monedaBase: m })
    } catch (err) {
      console.error('[ajustes] monedaBase error:', err)
      setMonedaBase(prev)
    } finally {
      setSavingMoneda(false)
    }
  }

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
      setBackupResult(`Importados: ${result.transactions} movimientos, ${result.assets} activos, ${result.budgets} presupuestos.`)
    } catch (err) {
      setBackupResult('Error: ' + String(err))
    } finally {
      setBackupAction(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Árbol de categorías ───────────────────────────────────────────────────────
  // Se invoca como función (no como <Componente/> definido acá adentro): así
  // no se remonta en cada render.
  function renderCategoryTree(tipo: 'gasto' | 'ingreso') {
    return (
      <CategoryTree
        groups={tipo === 'gasto' ? s.categoriasGasto : s.categoriasIngreso}
        onReorder={(list) => handleReorder(tipo, list)}
        onAddGroup={() => setGroupModal({ open: true, tipo, group: null })}
        onEditGroup={(group) => setGroupModal({ open: true, tipo, group })}
        onDeleteGroup={(group) => handleDeleteGroup(group.id, tipo)}
        onAddSub={(group) => setSubModal({ open: true, tipo, groupId: group.id, category: null })}
        onEditSub={(group, sub) => setSubModal({ open: true, tipo, groupId: group.id, category: sub })}
        onDeleteSub={(group, sub) => handleDeleteSubcat(sub.id, tipo, group.id)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Ajustes" subtitle="Javier & Mary" />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar">
        <div className="px-4 pb-28 space-y-5">

          {/* ── Perfil ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[24px] p-3.5 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand shadow-soft flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">
                {(user?.nombre || user?.email || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-gray-900 leading-tight truncate">{user?.nombre || 'Mi cuenta'}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email ?? 'Javier & Mary'}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">{monedaBase}</span>
          </motion.div>

          <SectionGroup title="General">

          {/* ── Cuenta ── */}
          <Section
            label="Cuenta"
            icon={<UserRound size={15} />}
            tint="#5b4fd6"
            hint="Moneda base y sesión"
            open={openSection === 'cuenta'}
            onToggle={() => toggle('cuenta')}
          >
            <div className="space-y-4 pt-1">
              <div>
                <p className="eyebrow mb-2">Moneda base</p>
                <Segmented
                  id="moneda-base"
                  size="lg"
                  value={monedaBase as Currency}
                  onChange={(m) => { if (!savingMoneda) handleMonedaBase(m) }}
                  options={(['ARS', 'COP', 'USD'] as Currency[]).map((m) => ({ value: m, label: m }))}
                  variant="solid"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">Los totales de la app se muestran en esta moneda</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openOnboarding}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-primary/10 text-primary text-sm font-semibold"
              >
                <Sparkles size={14} /> Ver la introducción
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-rose-500/10 text-rose-500 text-sm font-semibold disabled:opacity-50"
              >
                <LogOut size={14} />
                {signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
              </motion.button>
            </div>
          </Section>

          {/* ── Apariencia ── */}
          <Section
            label="Apariencia"
            icon={<Palette size={15} />}
            tint="#0ea5e9"
            hint={theme === 'system' ? 'Según el sistema' : theme === 'dark' ? 'Oscuro' : 'Claro'}
            open={openSection === 'apariencia'}
            onToggle={() => toggle('apariencia')}
          >
            <div className="space-y-2">
              <p className="eyebrow mb-2">Tema</p>
              <Segmented
                id="tema"
                size="lg"
                value={theme}
                onChange={changeTheme}
                options={[
                  { value: 'system', label: 'Sistema' },
                  { value: 'light', label: 'Claro' },
                  { value: 'dark', label: 'Oscuro' },
                ]}
              />
              <p className="text-[11px] text-gray-400">Se guarda en este dispositivo.</p>
            </div>
          </Section>

          {/* ── Notificaciones ── */}
          <Section
            label="Notificaciones"
            icon={<Bell size={15} />}
            tint="#f43f5e"
            hint="Recordatorios push"
            open={openSection === 'notif'}
            onToggle={() => { toggle('notif'); setPushError(null); checkPushEstado() }}
          >
            <div className="space-y-3 pt-1">
              <div className="text-xs text-gray-500 space-y-1.5">
                <p>📝 <span className="font-medium">Recordatorio diario (21 hs):</span> si ese día no cargaron ningún movimiento</p>
                <p>💳 <span className="font-medium">Cuotas del mes (día 1):</span> cuántas cuotas vencen y por cuánto</p>
              </div>

              {pushEstado === 'no-soportado' ? (
                <div className="bg-amber-500/10 ring-1 ring-amber-500/25 rounded-2xl px-3 py-2.5 text-xs text-amber-700">
                  Este navegador no soporta notificaciones. En iPhone: primero agregá la app a la
                  pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.
                </div>
              ) : (
                <button
                  onClick={handleTogglePush}
                  disabled={pushBusy || pushEstado === 'cargando'}
                  className={`w-full h-11 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50 ${
                    pushEstado === 'activo'
                      ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-600'
                      : 'bg-brand text-white shadow-soft'
                  }`}
                >
                  {pushBusy || pushEstado === 'cargando'
                    ? 'Un momento…'
                    : pushEstado === 'activo'
                      ? '✓ Activas en este dispositivo — tocá para desactivar'
                      : 'Activar en este dispositivo'}
                </button>
              )}

              {pushError && (
                <div className="bg-rose-500/10 ring-1 ring-rose-500/25 rounded-2xl px-3 py-2.5 text-xs text-rose-500">
                  {pushError}
                </div>
              )}
              <p className="text-[11px] text-gray-300">
                La activación es por dispositivo: actívenla cada uno en su teléfono.
              </p>
            </div>
          </Section>

          {/* ── Tipos de cambio ── */}
          <Section
            label="Tipos de cambio"
            icon={<ArrowLeftRight size={15} />}
            tint="#10b981"
            hint={`${(FUENTES_CAMBIO.find((f) => f.value === (s.fuenteCambio ?? 'mep'))?.label ?? '')} · ARS ${s.tipoCambio.ARS_USD.toLocaleString('es-AR')} · COP ${s.tipoCambio.COP_USD.toLocaleString('es-AR')}`}
            open={openSection === 'cambio'}
            onToggle={() => { toggle('cambio'); setArsRate(String(s?.tipoCambio.ARS_USD ?? 1200)); setCopRate(String(s?.tipoCambio.COP_USD ?? 4100)) }}
          >
            <div className="space-y-3 pt-1">
              <Segmented
                id="fuente-cambio"
                size="md"
                value={s.fuenteCambio ?? 'mep'}
                onChange={(f) => { if (!syncing) handleFuente(f) }}
                options={FUENTES_CAMBIO.map((f) => ({ value: f.value, label: f.label }))}
                variant="solid"
              />
              <p className="text-[11px] text-gray-500 leading-snug">
                {FUENTES_CAMBIO.find((f) => f.value === (s.fuenteCambio ?? 'mep'))?.detalle}.
                {' '}Cada mes pasado se convierte con su propio promedio.
              </p>
              {(s.fuenteCambio ?? 'mep') !== 'manual' ? (
                <div className="rounded-2xl bg-gray-500/[0.06] px-3.5 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm tabular-nums">
                    <span className="text-gray-500">1 USD</span>
                    <span className="font-semibold">ARS {s.tipoCambio.ARS_USD.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex justify-between text-sm tabular-nums">
                    <span className="text-gray-500">1 USD</span>
                    <span className="font-semibold">COP {s.tipoCambio.COP_USD.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-500">Actualizado {haceCuanto(s.cambioActualizado)}</span>
                    <button
                      onClick={handleSyncAhora}
                      disabled={syncing}
                      className="text-xs font-semibold text-primary inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Actualizando…' : 'Actualizar ahora'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
              <RateInput label="1 USD = ? ARS" value={arsRate} onChange={setArsRate} />
              <RateInput label="1 USD = ? COP" value={copRate} onChange={setCopRate} />
              <button
                onClick={saveRates}
                disabled={savingRate}
                className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all text-white shadow-soft ${
                  rateSaved ? 'bg-emerald-500' : 'bg-brand'
                }`}
              >
                {rateSaved ? <><Check size={14} /> Guardado</> : savingRate ? 'Guardando...' : 'Actualizar tipo de cambio'}
              </button>
                </>
              )}
              {rateError && (
                <div className="bg-rose-500/10 ring-1 ring-rose-500/25 rounded-2xl px-3 py-2 text-xs text-rose-500 font-medium">
                  {rateError}
                </div>
              )}
              {rateWarning && (
                <div className="bg-amber-500/10 ring-1 ring-amber-500/25 rounded-2xl px-3 py-2 text-xs text-amber-600 font-medium">
                  {rateWarning}
                </div>
              )}
              {(s?.historialTipoCambio ?? []).length > 0 && (
                <div className="space-y-1">
                  <p className="eyebrow pt-1">Historial</p>
                  {[...(s?.historialTipoCambio ?? [])].reverse().slice(0, 6).map((h) => (
                    <div key={h.mes} className="flex justify-between text-xs text-gray-500 py-1.5 border-b border-hairline tabular-nums">
                      <span className="capitalize">{monthLabel(h.mes)}{h.fuente ? '' : ' · manual'}</span>
                      <span>ARS {h.ARS_USD.toLocaleString('es-AR')} · COP {h.COP_USD.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Gastos hormiga ── */}
          <Section
            label="Gastos hormiga"
            icon={<Bug size={15} />}
            tint="#f59e0b"
            hint={`Hasta USD ${(s.hormiga ?? HORMIGA_DEFAULT).topeUsd} · hábito desde ${(s.hormiga ?? HORMIGA_DEFAULT).minCompras} compras`}
            open={openSection === 'hormiga'}
            onToggle={() => toggle('hormiga')}
          >
            <HormigaAjustes key={JSON.stringify(s.hormiga ?? null)} s={s} onGuardar={async (hormiga) => {
              await updateSettings(SHARED_USER_ID, { hormiga })
              setSettings({ ...s, hormiga })
            }} />
          </Section>

          </SectionGroup>

          <SectionGroup title="Organización">
          {/* ── Tarjetas de crédito ── */}
          <Section
            label="Tarjetas de crédito"
            icon={<CreditCard size={15} />}
            tint="#1e3a8a"
            hint={(s.tarjetas ?? []).length ? (s.tarjetas ?? []).map((t) => t.nombre).join(', ') : 'Sin tarjetas'}
            open={openSection === 'tarjetas'}
            onToggle={() => toggle('tarjetas')}
          >
            <TarjetasAjustes s={s} />
          </Section>

          {/* ── Categorías de Gasto ── */}
          <Section
            label="Categorías de gasto"
            icon={<Tags size={15} />}
            tint="#f97316"
            hint={`${s.categoriasGasto.length} grupos`}
            open={openSection === 'categorias'}
            onToggle={() => toggle('categorias')}
          >
            {renderCategoryTree('gasto')}
          </Section>

          {/* ── Categorías de Ingreso ── */}
          <Section
            label="Categorías de ingreso"
            icon={<Coins size={15} />}
            tint="#eab308"
            hint={`${s.categoriasIngreso.length} grupos`}
            open={openSection === 'categorias_ing'}
            onToggle={() => toggle('categorias_ing')}
          >
            {renderCategoryTree('ingreso')}
          </Section>

          {/* ── Tipos de activo/pasivo ── */}
          <Section
            label="Tipos de activo / pasivo"
            icon={<Layers size={15} />}
            tint="#06b6d4"
            open={openSection === 'tipos'}
            onToggle={() => { toggle('tipos'); setTiposActivo(s?.tiposActivo ?? []); setTiposPasivo(s?.tiposPasivo ?? []) }}
          >
            <div className="space-y-4 pt-1">
              {/* Activos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="eyebrow">Activos</p>
                  {editingTipoActivo
                    ? <button onClick={saveTiposActivo} className="text-xs text-primary font-semibold">Guardar</button>
                    : <button onClick={() => setEditingTipoActivo(true)} className="text-xs text-primary font-semibold flex items-center gap-1"><Pencil size={11} /> Editar</button>
                  }
                </div>
                {editingTipoActivo ? (
                  <div className="space-y-1.5">
                    {tiposActivo.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={t} onChange={(e) => { const c = [...tiposActivo]; c[i] = e.target.value; setTiposActivo(c) }}
                          className="flex-1 bg-gray-500/[0.06] rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
                        <button onClick={() => setTiposActivo(tiposActivo.filter((_, j) => j !== i))} className="text-red-400 p-1.5"><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newTipoActivo} onChange={(e) => setNewTipoActivo(e.target.value)} placeholder="Nuevo tipo..."
                        className="flex-1 border border-dashed border-gray-300 rounded-xl px-3 h-9 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary/25"
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTipoActivo.trim()) { setTiposActivo((p) => [...p, newTipoActivo.trim()]); setNewTipoActivo('') } }} />
                      <button onClick={() => { if (newTipoActivo.trim()) { setTiposActivo((p) => [...p, newTipoActivo.trim()]); setNewTipoActivo('') } }} className="px-3 text-primary font-semibold text-sm"><Plus size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tiposActivo.map((t) => <span key={t} className="px-3 py-1 bg-gray-500/[0.08] text-gray-600 text-xs font-medium rounded-full capitalize">{t}</span>)}
                  </div>
                )}
              </div>
              {/* Pasivos */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="eyebrow">Pasivos</p>
                  {editingTipoPasivo
                    ? <button onClick={saveTiposPasivo} className="text-xs text-primary font-semibold">Guardar</button>
                    : <button onClick={() => setEditingTipoPasivo(true)} className="text-xs text-primary font-semibold flex items-center gap-1"><Pencil size={11} /> Editar</button>
                  }
                </div>
                {editingTipoPasivo ? (
                  <div className="space-y-1.5">
                    {tiposPasivo.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={t} onChange={(e) => { const c = [...tiposPasivo]; c[i] = e.target.value; setTiposPasivo(c) }}
                          className="flex-1 bg-gray-500/[0.06] rounded-xl px-3 h-9 text-sm outline-none focus:ring-2 focus:ring-primary/25" />
                        <button onClick={() => setTiposPasivo(tiposPasivo.filter((_, j) => j !== i))} className="text-red-400 p-1.5"><Trash2 size={13} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input value={newTipoPasivo} onChange={(e) => setNewTipoPasivo(e.target.value)} placeholder="Nuevo tipo..."
                        className="flex-1 border border-dashed border-gray-300 rounded-xl px-3 h-9 text-sm bg-transparent outline-none focus:ring-2 focus:ring-primary/25"
                        onKeyDown={(e) => { if (e.key === 'Enter' && newTipoPasivo.trim()) { setTiposPasivo((p) => [...p, newTipoPasivo.trim()]); setNewTipoPasivo('') } }} />
                      <button onClick={() => { if (newTipoPasivo.trim()) { setTiposPasivo((p) => [...p, newTipoPasivo.trim()]); setNewTipoPasivo('') } }} className="px-3 text-primary font-semibold text-sm"><Plus size={14} /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {tiposPasivo.map((t) => <span key={t} className="px-3 py-1 bg-gray-500/[0.08] text-gray-600 text-xs font-medium rounded-full capitalize">{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {/* ── Vínculos de ahorro ── */}
          <Section
            label="Vínculos de ahorro"
            icon={<PiggyBank size={15} />}
            tint="#8b5cf6"
            hint={`${(s.ahorroLinks ?? []).length} configurados`}
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
                <div className="space-y-3 pt-1">
                  {ahorroLinks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Sin vínculos configurados</p>
                  ) : (
                    <div className="space-y-1.5">
                      {ahorroLinks.map((link) => {
                        const cat = flatCats.find((c) => c.id === link.categoriaId)
                        const asset = assets.find((a) => a.id === link.assetId)
                        return (
                          <div key={link.categoriaId} className="flex items-center gap-2 pl-3 pr-1 py-1 bg-gray-500/[0.06] rounded-2xl">
                            <span className="flex-1 text-xs text-gray-700 truncate">
                              {cat?.label ?? link.categoriaId} <span className="text-gray-400">→</span> {asset?.nombre ?? link.assetId}
                            </span>
                            <button onClick={() => removeLink(link.categoriaId)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-500/10 text-rose-500 flex-shrink-0" aria-label="Quitar vínculo">
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
                      className="flex-1 min-w-0 h-10 rounded-2xl bg-gray-500/[0.06] px-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Categoría...</option>
                      {flatCats.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                    <select
                      value={newLinkAssetId}
                      onChange={(e) => setNewLinkAssetId(e.target.value)}
                      className="flex-1 min-w-0 h-10 rounded-2xl bg-gray-500/[0.06] px-2.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Activo...</option>
                      {activoAssets.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                    <button
                      onClick={addLink}
                      disabled={!newLinkCatId || !newLinkAssetId}
                      className="h-10 px-3.5 rounded-2xl bg-brand text-white text-xs font-semibold shadow-soft disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus size={13} /> Agregar
                    </button>
                  </div>
                </div>
              )
            })()}
          </Section>

          </SectionGroup>

          <SectionGroup title="Datos">
          {/* ── Acciones del mes ── */}
          <Section
            label="Acciones del mes"
            icon={<CalendarCog size={15} />}
            tint="#3b82f6"
            hint={<span className="capitalize">{monthLabel(currentMonth)}{isClosed ? ' · cerrado' : ''}</span>}
            open={openSection === 'mes'}
            onToggle={() => {
              toggle('mes')
              resetMesFeedback()
              setClonarConfirm(null)
              setRecurrentesConfirm(null)
            }}
          >
            <div className="space-y-2 pt-1">
              {isClosed && (
                <div className="flex items-center gap-2 bg-amber-500/10 ring-1 ring-amber-500/25 rounded-2xl px-3 py-2.5">
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
              <ActionButton icon={<Trash2 size={14} />} label="Borrar mes" sublabel="Elimina todos los movimientos del mes actual" onClick={handleBorrarMes} loading={mesAction === 'borrando'} color="red" danger />
              {mesResult && (
                <div className="bg-emerald-500/10 ring-1 ring-emerald-500/25 rounded-2xl px-3 py-2.5 text-xs text-emerald-700 font-medium">
                  ✓ {mesResult}
                </div>
              )}
              {mesError && (
                <div className="bg-rose-500/10 ring-1 ring-rose-500/25 rounded-2xl px-3 py-2.5 text-xs text-rose-500 font-medium">
                  ✗ {mesError}
                </div>
              )}
            </div>
          </Section>

          {/* ── Importar / Exportar ── */}
          <Section
            label="Importar / Exportar"
            icon={<DatabaseBackup size={15} />}
            tint="#64748b"
            hint="Backup en JSON"
            open={openSection === 'datos'}
            onToggle={() => { toggle('datos'); setBackupResult(null) }}
          >
            <div className="space-y-2 pt-1">
              <ActionButton icon={<Download size={14} />} label="Exportar backup" sublabel="Descarga todos tus datos como archivo JSON" onClick={handleExport} loading={backupAction === 'exportando'} color="blue" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!!backupAction}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-emerald-500/[0.08] text-emerald-600 text-left transition-all active:scale-[0.99]"
              >
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0"><Upload size={14} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{backupAction === 'importando' ? 'Importando...' : 'Importar backup'}</p>
                  <p className="text-[11px] opacity-70 mt-0.5">Restaura desde un archivo JSON exportado</p>
                </div>
                <ChevronRight size={13} className="opacity-40 flex-shrink-0" />
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
              {backupResult && (
                <div className="bg-blue-500/10 ring-1 ring-blue-500/25 rounded-2xl px-3 py-2.5 text-xs text-blue-600 font-medium">
                  {backupResult}
                </div>
              )}
            </div>
          </Section>
          </SectionGroup>

        </div>
      </div>

      {/* ── Modal grupo ── */}
      <CategoryModal
        open={groupModal.open}
        category={groupModal.group ? { id: groupModal.group.id, nombre: groupModal.group.nombre, color: groupModal.group.color, activa: groupModal.group.activa } : null}
        onClose={() => setGroupModal((prev) => ({ ...prev, open: false }))}
        onSave={(cat) => handleSaveGroup(cat, groupModal.tipo)}
        onDelete={groupModal.group ? (id) => handleDeleteGroup(id, groupModal.tipo) : undefined}
        title={groupModal.group ? 'Editar categoría padre' : 'Nueva categoría padre'}
      />

      {/* ── Modal subcategoría ── */}
      <CategoryModal
        open={subModal.open}
        category={subModal.category}
        onClose={() => setSubModal((prev) => ({ ...prev, open: false }))}
        onSave={(cat) => handleSaveSubcat(cat, subModal.tipo, subModal.groupId)}
        onDelete={subModal.category ? (id) => handleDeleteSubcat(id, subModal.tipo, subModal.groupId) : undefined}
        title={subModal.category ? 'Editar subcategoría' : 'Nueva subcategoría'}
      />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="eyebrow px-2 mb-2">{title}</p>
      <div className="glass rounded-[24px] overflow-hidden divide-y divide-[var(--hairline)]">
        {children}
      </div>
    </motion.div>
  )
}

function Section({ label, icon, tint, hint, open, onToggle, children }: {
  label: string
  icon: React.ReactNode
  tint: string
  hint?: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  // Deslizar hacia la derecha cierra la sub-página (como el "atrás" de iOS)
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 90 || info.velocity.x > 500) onToggle()
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-500/[0.05] transition-colors"
      >
        <span
          className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${tint}cc, ${tint})` }}
        >
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-900 leading-tight">{label}</span>
          {hint && <span className="block text-[11px] text-gray-400 truncate mt-0.5">{hint}</span>}
        </span>
        <ChevronRight size={17} className="text-gray-300" />
      </button>

      {/* Sub-página: entra desde la derecha sobre la lista */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={label}
            className="fixed inset-0 mx-auto w-full max-w-[390px] z-30 flex flex-col bg-[var(--background)]"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={springSoft}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0, right: 0.8 }}
            dragDirectionLock
            onDragEnd={handleDragEnd}
          >
            <header className="flex-shrink-0 px-2 pt-[max(2.75rem,env(safe-area-inset-top))] pb-2">
              <button
                onClick={onToggle}
                className="flex items-center gap-0.5 h-11 pl-1 pr-3 rounded-full text-primary text-sm font-semibold"
              >
                <ChevronLeft size={20} /> Ajustes
              </button>
              <div className="flex items-center gap-3 px-2 mt-1">
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${tint}cc, ${tint})` }}
                >
                  {icon}
                </span>
                <h2 className="text-[26px] font-bold tracking-tight text-gray-900 leading-tight">{label}</h2>
              </div>
            </header>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 pt-3 pb-28">
              <div className="glass rounded-[24px] p-4">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Criterio de gastos hormiga del análisis de Resúmenes */
function HormigaAjustes({ s, onGuardar }: { s: Settings; onGuardar: (h: { topeUsd: number; minCompras: number }) => Promise<void> }) {
  const actual = { ...HORMIGA_DEFAULT, ...s.hormiga }
  const [tope, setTope] = useState(String(actual.topeUsd))
  const [min, setMin] = useState(String(actual.minCompras))
  const [estado, setEstado] = useState<'idle' | 'guardando' | 'ok' | 'error'>('idle')
  const topeN = parseFloat(tope.replace(',', '.'))
  const minN = parseInt(min, 10)
  const valido = topeN > 0 && minN >= 2

  async function guardar() {
    if (!valido) return
    setEstado('guardando')
    try {
      await onGuardar({ topeUsd: topeN, minCompras: minN })
      setEstado('ok')
    } catch {
      setEstado('error')
    }
  }

  return (
    <div className="space-y-3 pt-1">
      <p className="text-[11px] text-gray-500 leading-snug">
        Hábitos: comercios con muchas compras en el mes (las propinas se suman al comercio). Compras chicas: sueltas hasta un tope en dólares, así la inflación no cambia el criterio.
      </p>
      <RateInput label="Compra chica: hasta USD" value={tope} onChange={(v) => { setTope(v); setEstado('idle') }} />
      <RateInput label="Hábito: desde N compras/mes" value={min} onChange={(v) => { setMin(v); setEstado('idle') }} />
      <button onClick={guardar} disabled={!valido || estado === 'guardando'}
        className={`w-full h-11 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 text-white shadow-soft disabled:opacity-60 ${estado === 'ok' ? 'bg-emerald-500' : 'bg-brand'}`}>
        {estado === 'ok' ? <><Check size={14} /> Guardado</> : estado === 'guardando' ? 'Guardando…' : 'Guardar criterio'}
      </button>
      {estado === 'error' && <p className="text-xs text-rose-500">No se pudo guardar.</p>}
    </div>
  )
}

function RateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm text-gray-600 flex-1">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-32 h-10 bg-gray-500/[0.06] rounded-2xl px-3 text-sm font-semibold text-right tabular-nums outline-none border border-transparent focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10 transition-all" />
    </div>
  )
}

function ActionButton({ icon, label, sublabel, onClick, loading, color, danger }: {
  icon: React.ReactNode; label: string; sublabel: string; onClick: () => void; loading: boolean; color: 'purple' | 'blue' | 'green' | 'red'; danger?: boolean
}) {
  const colorMap = {
    purple: { box: 'text-primary bg-primary/[0.07]', icon: 'bg-primary/15' },
    blue:   { box: 'text-blue-600 bg-blue-500/[0.08]', icon: 'bg-blue-500/15' },
    green:  { box: 'text-emerald-600 bg-emerald-500/[0.08]', icon: 'bg-emerald-500/15' },
    red:    { box: 'text-rose-500 bg-rose-500/[0.08]', icon: 'bg-rose-500/15' },
  }
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick} disabled={loading}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-left ${colorMap[color].box} ${loading ? 'opacity-50' : ''} ${danger ? 'ring-1 ring-rose-500/30' : ''}`}>
      <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color].icon}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight">{loading ? 'Procesando...' : label}</p>
        <p className="text-[11px] opacity-70 mt-0.5 leading-tight">{sublabel}</p>
      </div>
      <ChevronRight size={14} className="opacity-40 flex-shrink-0" />
    </motion.button>
  )
}
