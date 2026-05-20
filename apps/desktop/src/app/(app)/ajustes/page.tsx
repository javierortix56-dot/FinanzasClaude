'use client'

import { useState, KeyboardEvent, useRef } from 'react'
import { Save, Download, Upload, Plus, Trash2, ChevronDown, ChevronRight, Lock, AlertTriangle } from 'lucide-react'
import { useSettingsStore } from '@finanzas/core/store/useSettingsStore'
import { useUIStore } from '@finanzas/core/store/useUIStore'
import { useTransactionStore } from '@finanzas/core/store/useTransactionStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { updateSettings, DEFAULT_SETTINGS } from '@finanzas/core/lib/settings'
import {
  cloneMonthTransactions,
  createRecurringTransactions,
  countMonthTransactions,
  deleteMonthTransactions,
} from '@finanzas/core/lib/transactions'
import { shiftMonth, monthLabel } from '@finanzas/core/lib/constants'
import { exportBackup, downloadBackup, importBackup, parseBackupFile } from '@finanzas/core/lib/backup'
import { CategoryGroup } from '@finanzas/core/types'

export default function AjustesPage() {
  const settings = useSettingsStore((s) => s.settings) ?? DEFAULT_SETTINGS
  const { currentMonth } = useTransactionStore()
  const showToast = useUIStore((s) => s.showToast)

  // ── Tipos de cambio ────────────────────────────────────────────────────────
  const [arsUsd, setArsUsd] = useState(String(settings.tipoCambio.ARS_USD))
  const [copUsd, setCopUsd] = useState(String(settings.tipoCambio.COP_USD))
  const [savingRates, setSavingRates] = useState(false)

  async function saveRates(saveToHistory = false) {
    setSavingRates(true)
    try {
      const tipoCambio = {
        ARS_USD: parseFloat(arsUsd) || 0,
        COP_USD: parseFloat(copUsd) || 0,
      }
      const patch: Parameters<typeof updateSettings>[1] = { tipoCambio }
      if (saveToHistory) {
        const existing = settings.historialTipoCambio.filter((r) => r.mes !== currentMonth)
        patch.historialTipoCambio = [...existing, { mes: currentMonth, ...tipoCambio }]
          .sort((a, b) => a.mes.localeCompare(b.mes))
      }
      await updateSettings('shared', patch)
      showToast(saveToHistory ? 'Tipos de cambio guardados e historial actualizado' : 'Tipos de cambio guardados')
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSavingRates(false)
    }
  }

  // ── Categorías ─────────────────────────────────────────────────────────────
  const [gastoGroups, setGastoGroups] = useState<CategoryGroup[]>(settings.categoriasGasto)
  const [ingresoGroups, setIngresoGroups] = useState<CategoryGroup[]>(settings.categoriasIngreso)
  const [savingCats, setSavingCats] = useState(false)

  async function saveCats() {
    setSavingCats(true)
    try {
      await updateSettings('shared', {
        categoriasGasto:   gastoGroups,
        categoriasIngreso: ingresoGroups,
      })
      showToast('Categorías guardadas')
    } catch {
      showToast('Error al guardar categorías', 'error')
    } finally {
      setSavingCats(false)
    }
  }

  // ── Tipos de activo/pasivo ─────────────────────────────────────────────────
  const [tiposActivo, setTiposActivo]   = useState<string[]>(settings.tiposActivo)
  const [tiposPasivo, setTiposPasivo]   = useState<string[]>(settings.tiposPasivo)
  const [newTipoActivo, setNewTipoActivo] = useState('')
  const [newTipoPasivo, setNewTipoPasivo] = useState('')
  const [savingTipos, setSavingTipos] = useState(false)

  async function saveTipos() {
    setSavingTipos(true)
    try {
      await updateSettings('shared', { tiposActivo, tiposPasivo })
      showToast('Tipos guardados')
    } catch {
      showToast('Error al guardar', 'error')
    } finally {
      setSavingTipos(false)
    }
  }

  // ── Operaciones del mes ────────────────────────────────────────────────────
  async function handleClone() {
    const prev = shiftMonth(currentMonth, -1)
    const existing = await countMonthTransactions(currentMonth)
    if (existing > 0) {
      if (!confirm(`Ya hay ${existing} movimientos en ${monthLabel(currentMonth)}. ¿Clonar igual desde ${monthLabel(prev)}?`)) return
    }
    try {
      const n = await cloneMonthTransactions(prev, currentMonth)
      showToast(`Clonados ${n} movimientos de ${monthLabel(prev)}`)
    } catch {
      showToast('Error al clonar', 'error')
    }
  }

  async function handleRecurring() {
    try {
      const n = await createRecurringTransactions(currentMonth)
      showToast(n > 0 ? `Creados ${n} recurrentes` : 'No hay movimientos recurrentes en el mes anterior')
    } catch {
      showToast('Error', 'error')
    }
  }

  // ── Cerrar / borrar mes ────────────────────────────────────────────────────
  const isClosed = (settings.mesesCerrados ?? []).includes(currentMonth)

  async function handleCloseMonth() {
    if (!confirm(`¿Cerrar ${monthLabel(currentMonth)}? Esto guardará los tipos de cambio actuales en el historial.`)) return
    try {
      const closed = [...(settings.mesesCerrados ?? []).filter((m) => m !== currentMonth), currentMonth]
      const tipoCambio = { ARS_USD: parseFloat(arsUsd) || settings.tipoCambio.ARS_USD, COP_USD: parseFloat(copUsd) || settings.tipoCambio.COP_USD }
      const existing = settings.historialTipoCambio.filter((r) => r.mes !== currentMonth)
      await updateSettings('shared', {
        mesesCerrados: closed,
        historialTipoCambio: [...existing, { mes: currentMonth, ...tipoCambio }].sort((a, b) => a.mes.localeCompare(b.mes)),
      })
      showToast(`Mes ${monthLabel(currentMonth)} cerrado`)
    } catch {
      showToast('Error al cerrar mes', 'error')
    }
  }

  async function handleReopenMonth() {
    if (!confirm(`¿Reabrir ${monthLabel(currentMonth)}?`)) return
    try {
      await updateSettings('shared', {
        mesesCerrados: (settings.mesesCerrados ?? []).filter((m) => m !== currentMonth),
      })
      showToast(`Mes ${monthLabel(currentMonth)} reabierto`)
    } catch {
      showToast('Error', 'error')
    }
  }

  async function handleDeleteMonth() {
    if (!confirm(`¿Borrar TODOS los movimientos de ${monthLabel(currentMonth)}? Esta acción no se puede deshacer.`)) return
    if (!confirm('Confirmá nuevamente: se eliminarán todos los movimientos del mes.')) return
    try {
      const n = await deleteMonthTransactions(currentMonth)
      showToast(`Eliminados ${n} movimientos de ${monthLabel(currentMonth)}`)
    } catch {
      showToast('Error al borrar', 'error')
    }
  }

  // ── Importar / Exportar ────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportBackup('shared')
      downloadBackup(data)
      showToast(`Backup exportado (${data.transactions.length} movimientos)`)
    } catch {
      showToast('Error al exportar', 'error')
    } finally {
      setExporting(false)
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true)
    try {
      const data = await parseBackupFile(file)
      if (!confirm(`¿Importar ${(data.transactions as unknown[]).length} movimientos y ${(data.assets as unknown[]).length} cuentas? Los datos existentes NO se borran.`)) return
      const result = await importBackup('shared', data)
      showToast(`Importados ${result.transactions} movimientos y ${result.assets} cuentas`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al importar', 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-2xl font-semibold tracking-tight">Ajustes</h2>

      {/* Tipos de cambio */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Tipos de cambio</div>
          <div className="text-xs text-muted mt-0.5">Se aplican a todas las conversiones. Podés guardar al historial mensual.</div>
        </div>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>USD / ARS</Label>
              <Input type="number" value={arsUsd} onChange={(e) => setArsUsd(e.target.value)} />
            </div>
            <div>
              <Label>USD / COP</Label>
              <Input type="number" value={copUsd} onChange={(e) => setCopUsd(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => saveRates(false)} disabled={savingRates} variant="secondary">
              <Save className="h-4 w-4" /> {savingRates ? 'Guardando…' : 'Guardar'}
            </Button>
            <Button onClick={() => saveRates(true)} disabled={savingRates}>
              <Save className="h-4 w-4" /> Guardar + agregar al historial ({monthLabel(currentMonth)})
            </Button>
          </div>

          {/* Historial */}
          {settings.historialTipoCambio.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Historial</div>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-surface-2/60 text-muted uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Mes</th>
                      <th className="px-3 py-2 text-right font-medium">USD/ARS</th>
                      <th className="px-3 py-2 text-right font-medium">USD/COP</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...settings.historialTipoCambio].reverse().map((r) => (
                      <tr key={r.mes} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground font-medium">{monthLabel(r.mes)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.ARS_USD.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-foreground">{r.COP_USD.toLocaleString('es-AR')}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={async () => {
                              const updated = settings.historialTipoCambio.filter((x) => x.mes !== r.mes)
                              await updateSettings('shared', { historialTipoCambio: updated })
                              showToast('Entrada eliminada')
                            }}
                            className="text-muted hover:text-expense"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Categorías */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Categorías</div>
          <div className="text-xs text-muted mt-0.5">Editá grupos y subcategorías. Los cambios se aplican al guardar.</div>
        </div>
        <CardContent className="pt-5 space-y-6">
          <CategoriesEditor label="Egresos" groups={gastoGroups} onChange={setGastoGroups} />
          <CategoriesEditor label="Ingresos" groups={ingresoGroups} onChange={setIngresoGroups} />
          <Button onClick={saveCats} disabled={savingCats}>
            <Save className="h-4 w-4" /> {savingCats ? 'Guardando…' : 'Guardar categorías'}
          </Button>
        </CardContent>
      </Card>

      {/* Tipos de activo/pasivo */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Tipos de cuenta</div>
        </div>
        <CardContent className="pt-5 space-y-4">
          <TiposList label="Tipos de activo" items={tiposActivo} onChange={setTiposActivo} newItem={newTipoActivo} onNewChange={setNewTipoActivo} />
          <TiposList label="Tipos de pasivo" items={tiposPasivo} onChange={setTiposPasivo} newItem={newTipoPasivo} onNewChange={setNewTipoPasivo} />
          <Button onClick={saveTipos} disabled={savingTipos}>
            <Save className="h-4 w-4" /> {savingTipos ? 'Guardando…' : 'Guardar tipos'}
          </Button>
        </CardContent>
      </Card>

      {/* Operaciones del mes */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Operaciones del mes</div>
          <div className="text-xs text-muted mt-0.5">Sobre {monthLabel(currentMonth)}.{isClosed ? ' · Cerrado' : ''}</div>
        </div>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium">Clonar mes anterior</div>
              <div className="text-xs text-muted">Duplica los movimientos de {monthLabel(shiftMonth(currentMonth, -1))} como pendientes.</div>
            </div>
            <Button variant="secondary" onClick={handleClone}>Clonar</Button>
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium">Crear recurrentes</div>
              <div className="text-xs text-muted">Trae los movimientos marcados como recurrentes del mes anterior.</div>
            </div>
            <Button variant="secondary" onClick={handleRecurring}>Crear</Button>
          </div>
        </CardContent>
      </Card>

      {/* Importar / Exportar */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Datos</div>
          <div className="text-xs text-muted mt-0.5">Exportar o importar un backup completo en formato JSON.</div>
        </div>
        <CardContent className="pt-5 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? 'Exportando…' : 'Exportar backup'}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4" /> {importing ? 'Importando…' : 'Importar backup'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
            }}
          />
        </CardContent>
      </Card>

      {/* Zona de peligro */}
      <Card className="border-expense/30">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-expense" /> Zona de peligro
          </div>
          <div className="text-xs text-muted mt-0.5">Acciones irreversibles sobre {monthLabel(currentMonth)}.</div>
        </div>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-border">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted" />
                {isClosed ? 'Mes cerrado' : 'Cerrar mes'}
              </div>
              <div className="text-xs text-muted">
                {isClosed
                  ? `${monthLabel(currentMonth)} está cerrado. Podés reabrirlo.`
                  : 'Congela el mes y guarda los tipos de cambio en el historial.'}
              </div>
            </div>
            {isClosed ? (
              <Button variant="secondary" onClick={handleReopenMonth}>Reabrir</Button>
            ) : (
              <Button variant="secondary" onClick={handleCloseMonth}>Cerrar mes</Button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-expense/30 bg-expense/5">
            <div>
              <div className="text-sm font-medium text-expense">Borrar mes</div>
              <div className="text-xs text-muted">Elimina todos los movimientos de {monthLabel(currentMonth)}. No se puede deshacer.</div>
            </div>
            <Button variant="secondary" onClick={handleDeleteMonth} className="border-expense/40 text-expense hover:bg-expense/10">
              Borrar mes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Acerca de */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <div className="text-sm font-semibold">Acerca de</div>
        </div>
        <CardContent className="pt-5 text-sm text-muted space-y-1">
          <p>Finanzas J&amp;M Desktop · v0.2</p>
          <p>Sincronizado con la app móvil mediante el mismo proyecto Supabase.</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Editor de grupos de categorías ────────────────────────────────────────────

function CategoriesEditor({
  label,
  groups,
  onChange,
}: {
  label: string
  groups: CategoryGroup[]
  onChange: (groups: CategoryGroup[]) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function updateGroup(id: string, patch: Partial<CategoryGroup>) {
    onChange(groups.map((g) => g.id === id ? { ...g, ...patch } : g))
  }

  function addGroup() {
    const id = `grp_${Date.now()}`
    const newGroup: CategoryGroup = { id, nombre: 'Nueva categoría', color: '#94a3b8', activa: true, subcategorias: [] }
    onChange([...groups, newGroup])
    setExpanded((prev) => new Set([...prev, id]))
  }

  function deleteGroup(id: string) {
    if (!confirm('¿Eliminar este grupo y todas sus subcategorías?')) return
    onChange(groups.filter((g) => g.id !== id))
  }

  function addSubcat(groupId: string) {
    const id = `sub_${Date.now()}`
    const parentColor = groups.find((g) => g.id === groupId)?.color ?? '#94a3b8'
    onChange(groups.map((g) =>
      g.id === groupId
        ? { ...g, subcategorias: [...g.subcategorias, { id, nombre: 'Nueva subcategoría', color: parentColor, activa: true }] }
        : g,
    ))
  }

  function updateSubcat(groupId: string, subcatId: string, patch: { nombre?: string; color?: string; activa?: boolean }) {
    onChange(groups.map((g) =>
      g.id === groupId
        ? { ...g, subcategorias: g.subcategorias.map((s) => s.id === subcatId ? { ...s, ...patch } : s) }
        : g,
    ))
  }

  function deleteSubcat(groupId: string, subcatId: string) {
    onChange(groups.map((g) =>
      g.id === groupId
        ? { ...g, subcategorias: g.subcategorias.filter((s) => s.id !== subcatId) }
        : g,
    ))
  }

  return (
    <div>
      <div className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{label}</div>
      <div className="space-y-1.5">
        {groups.map((g) => (
          <div key={g.id} className="border border-border rounded-md overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-2/40">
              <button
                type="button"
                onClick={() => toggleExpand(g.id)}
                className="text-muted hover:text-foreground flex-shrink-0"
              >
                {expanded.has(g.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <input
                type="color"
                value={g.color}
                onChange={(e) => updateGroup(g.id, { color: e.target.value })}
                className="h-5 w-5 rounded cursor-pointer border-0 p-0 flex-shrink-0"
              />
              <input
                value={g.nombre}
                onChange={(e) => updateGroup(g.id, { nombre: e.target.value })}
                className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground focus:outline-none"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-muted cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={g.activa}
                  onChange={(e) => updateGroup(g.id, { activa: e.target.checked })}
                  className="accent-primary"
                />
                Activa
              </label>
              <button
                type="button"
                onClick={() => deleteGroup(g.id)}
                className="text-muted hover:text-expense p-0.5 flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {expanded.has(g.id) && (
              <div className="border-t border-border px-3 py-2 space-y-1">
                {g.subcategorias.length === 0 && (
                  <div className="text-xs text-muted py-1 pl-6">Sin subcategorías</div>
                )}
                {g.subcategorias.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-0.5 pl-6">
                    <input
                      type="color"
                      value={s.color}
                      onChange={(e) => updateSubcat(g.id, s.id, { color: e.target.value })}
                      className="h-4 w-4 rounded cursor-pointer border-0 p-0 flex-shrink-0"
                    />
                    <input
                      value={s.nombre}
                      onChange={(e) => updateSubcat(g.id, s.id, { nombre: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none"
                    />
                    <label className="inline-flex items-center gap-1 text-xs text-muted cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={s.activa}
                        onChange={(e) => updateSubcat(g.id, s.id, { activa: e.target.checked })}
                        className="accent-primary"
                      />
                      Activa
                    </label>
                    <button
                      type="button"
                      onClick={() => deleteSubcat(g.id, s.id)}
                      className="text-muted hover:text-expense p-0.5 flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addSubcat(g.id)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1 pl-6"
                >
                  <Plus className="h-3 w-3" /> Agregar subcategoría
                </button>
              </div>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addGroup}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-2"
        >
          <Plus className="h-3 w-3" /> Agregar grupo
        </button>
      </div>
    </div>
  )
}

// ── Lista editable de tipos (strings) ─────────────────────────────────────────

function TiposList({
  label, items, onChange, newItem, onNewChange,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  newItem: string
  onNewChange: (v: string) => void
}) {
  function addItem() {
    const t = newItem.trim()
    if (t && !items.includes(t)) onChange([...items, t])
    onNewChange('')
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addItem() }
  }

  return (
    <div>
      <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">{label}</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((item) => (
          <span key={item} className="inline-flex items-center gap-1.5 text-xs bg-surface-2 border border-border rounded-md px-2.5 py-1">
            {item}
            <button type="button" onClick={() => onChange(items.filter((i) => i !== item))} className="text-muted hover:text-expense">
              <Trash2 className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newItem}
          onChange={(e) => onNewChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Nuevo tipo…"
          className="flex h-8 rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48"
        />
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-1"
        >
          <Plus className="h-3 w-3" /> Agregar
        </button>
      </div>
    </div>
  )
}
