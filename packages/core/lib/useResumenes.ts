// Estado de la vista "Resúmenes" (compartido por mobile y desktop; cada app
// pone su propia UI encima).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useUIStore } from '../store/useUIStore'
import { subscribeToCuotas } from './cuotas'
import { analizarPeriodo } from './resumenAnalisis'
import { analizarFinanciacion, compararConAnteriores, evaluarMetas } from './resumenExtras'
import {
  ResultadoConciliacion, cargosComoGasto, conciliar, fetchEgresosDesde, pasarATarjeta, periodoDelResumen,
  registrarDesdeResumen, tarjetaDelResumen,
} from './conciliacion'
import { categoriaPorDefecto } from './comprobantes'
import { useTransactionStore } from '../store/useTransactionStore'
import { borrarResumen, categoriasDeGasto, existeResumen, extraerResumen, fetchResumenes, guardarResumen } from './resumenes'
import {
  Reglas, agruparComercios, aplicarReglas, editarGrupo, fetchReglas, guardarReglas, recategorizarComercio, reglasDe,
} from './comercioReglas'
import { CompraCuotas, Currency, Resumen, ResumenItem, Settings, Tarjeta, Transaction } from '../types'

export type EstadoSubida =
  | { paso: 'inactivo' }
  | { paso: 'leyendo'; archivo: string }
  | { paso: 'revisar'; resumen: Resumen; reemplaza: boolean }
  | { paso: 'guardando'; resumen: Resumen; reemplaza: boolean }
  | { paso: 'error'; mensaje: string }

const CLAVE_TARJETAS = 'resumen-tarjeta-por-emisor'
function leerTarjetasElegidas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLAVE_TARJETAS) ?? '{}') } catch { return {} }
}

export interface ConciliacionResumen {
  resumen: Resumen
  tarjeta: Tarjeta | null
  resultado: ResultadoConciliacion | null
}

export function useResumenes(s: Settings, base: Currency, creadoPor: string) {
  const [resumenes, setResumenes] = useState<Resumen[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [periodoElegido, setPeriodo] = useState<string | null>(null)
  const [subida, setSubida] = useState<EstadoSubida>({ paso: 'inactivo' })
  const [compras, setCompras] = useState<CompraCuotas[]>([])
  // Nombre y categoría elegidos para cada comercio (si falla la carga, se
  // sigue sin reglas: todo aparece como nuevo)
  const [reglas, setReglas] = useState<Reglas>(new Map())
  useEffect(() => { fetchReglas().then(setReglas).catch(() => {}) }, [])

  useEffect(() => subscribeToCuotas(setCompras), [])

  const recargar = useCallback(async () => {
    try {
      setResumenes(await fetchResumenes())
      setErrorCarga(null)
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : String(err))
      setResumenes([])
    }
  }, [])

  useEffect(() => {
    let cancel = false
    fetchResumenes()
      .then((r) => { if (!cancel) { setResumenes(r); setErrorCarga(null) } })
      .catch((err) => { if (!cancel) { setErrorCarga(err instanceof Error ? err.message : String(err)); setResumenes([]) } })
    return () => { cancel = true }
  }, [])

  const periodos = useMemo(
    () => [...new Set((resumenes ?? []).map((r) => r.periodo))].sort().reverse(),
    [resumenes],
  )
  const periodo = periodoElegido && periodos.includes(periodoElegido) ? periodoElegido : periodos[0] ?? null

  const analisis = useMemo(
    () => (resumenes && periodo ? analizarPeriodo(resumenes, periodo, base, s, compras) : null),
    [resumenes, periodo, base, s, compras],
  )

  // Análisis que miran varios períodos: costo de financiarse, comparación con
  // los resúmenes anteriores y metas de Ajustes
  const extras = useMemo(() => {
    if (!resumenes || !periodo) return null
    return {
      financiacion: analizarFinanciacion(resumenes, periodo, base, s),
      comparativa: compararConAnteriores(resumenes, periodo, base, s),
      metas: evaluarMetas(resumenes, periodo, base, s),
    }
  }, [resumenes, periodo, base, s])

  // ── Contraste con los gastos registrados con tarjeta de crédito
  const [elegidas, setElegidas] = useState<Record<string, string>>({})
  useEffect(() => { setElegidas(leerTarjetasElegidas()) }, [])
  function elegirTarjeta(emisor: string, tarjetaId: string) {
    const next = { ...elegidas, [emisor]: tarjetaId }
    setElegidas(next)
    try { localStorage.setItem(CLAVE_TARJETAS, JSON.stringify(next)) } catch { /* sin almacenamiento */ }
  }
  const tarjetasDelPeriodo = useMemo(() => {
    const tarjetas = s.tarjetas ?? []
    return (analisis?.resumenes ?? []).filter((r) => r.tipo === 'tarjeta').map((r) => ({
      resumen: r,
      tarjeta: tarjetas.find((t) => t.id === elegidas[r.emisor]) ?? tarjetaDelResumen(r, tarjetas) ?? null,
    }))
  }, [analisis, s.tarjetas, elegidas])
  const storeTxs = useTransactionStore((st) => st.transactions)
  const [egresos, setEgresos] = useState<Transaction[] | null>(null)
  const desdeConciliacion = useMemo(() => {
    const desdes = tarjetasDelPeriodo.map((x) => periodoDelResumen(x.resumen)?.desde).filter((d): d is string => !!d).sort()
    return desdes[0] ?? null
  }, [tarjetasDelPeriodo])
  const [versionEgresos, setVersionEgresos] = useState(0)
  useEffect(() => {
    if (!desdeConciliacion) { setEgresos(null); return }
    let cancel = false
    fetchEgresosDesde(desdeConciliacion).then((t) => { if (!cancel) setEgresos(t) }).catch(() => { if (!cancel) setEgresos([]) })
    return () => { cancel = true }
  }, [desdeConciliacion, storeTxs, versionEgresos])
  const conciliaciones = useMemo<ConciliacionResumen[]>(
    () => tarjetasDelPeriodo.map(({ resumen, tarjeta }) => ({
      resumen, tarjeta, resultado: tarjeta && egresos ? conciliar(resumen, tarjeta, egresos) : null,
    })),
    [tarjetasDelPeriodo, egresos],
  )
  async function conciliarAccion(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      setVersionEgresos((v) => v + 1)
      useUIStore.getState().showToast(ok)
    } catch (err) {
      useUIStore.getState().showToast(`No se pudo guardar: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }
  const agregarFaltantes = (items: ResumenItem[], tarjeta: Tarjeta) =>
    conciliarAccion(() => registrarDesdeResumen(items, tarjeta, categoriaPorDefecto(s), creadoPor), 'Gastos agregados')
  const agregarCargos = (r: Resumen, cargos: ResumenItem[], tarjeta: Tarjeta) =>
    conciliarAccion(() => registrarDesdeResumen(cargosComoGasto(r, cargos), tarjeta, categoriaPorDefecto(s), creadoPor), 'Cargos agregados')
  const pasarGastos = (txs: Transaction[], tarjeta: Tarjeta) =>
    conciliarAccion(() => pasarATarjeta(txs, tarjeta), `Pasados a ${tarjeta.nombre}`)

  const itemsPeriodo = useMemo(() => analisis?.resumenes.flatMap((r) => r.items) ?? [], [analisis])

  async function subir(file: File) {
    setSubida({ paso: 'leyendo', archivo: file.name })
    try {
      const extraido = await extraerResumen(file, s, creadoPor)
      const validas = new Set(categoriasDeGasto(s).map((c) => c.id))
      const resumen = { ...extraido, items: aplicarReglas(extraido.items, reglas, validas) }
      const reemplaza = await existeResumen(resumen.emisor, resumen.periodo)
      setSubida({ paso: 'revisar', resumen, reemplaza })
    } catch (err) {
      setSubida({ paso: 'error', mensaje: err instanceof Error ? err.message : String(err) })
    }
  }

  async function confirmar() {
    if (subida.paso !== 'revisar') return
    const { resumen, reemplaza } = subida
    setSubida({ paso: 'guardando', resumen, reemplaza })
    try {
      // Lo revisado queda como regla para los próximos resúmenes
      await guardarReglas(reglasDe(resumen.items))
      await guardarResumen(resumen)
      setReglas(await fetchReglas())
      await recargar()
      setPeriodo(resumen.periodo)
      setSubida({ paso: 'inactivo' })
    } catch (err) {
      setSubida({ paso: 'error', mensaje: err instanceof Error ? err.message : String(err) })
    }
  }

  const descartar = () => setSubida({ paso: 'inactivo' })

  // Comercios del resumen en revisión (nuevos primero) y su edición
  const gruposRevision = useMemo(
    () => (subida.paso === 'revisar' || subida.paso === 'guardando' ? agruparComercios(subida.resumen.items, reglas) : []),
    [subida, reglas],
  )
  function editarEnRevision(clave: string, nombre: string, categoria: string | null) {
    setSubida((st) => st.paso === 'revisar'
      ? { ...st, resumen: { ...st.resumen, items: editarGrupo(st.resumen.items, clave, nombre, categoria) } }
      : st)
  }

  // Comercios del período ya guardado, para recategorizar
  const comercios = useMemo(() => agruparComercios(itemsPeriodo, reglas), [itemsPeriodo, reglas])
  async function recategorizar(clave: string, nombre: string, categoria: string | null) {
    try {
      await recategorizarComercio(resumenes ?? [], clave, nombre, categoria)
      await recargar()
      setReglas(await fetchReglas())
      useUIStore.getState().showToast('Comercio actualizado en todos los resúmenes')
    } catch (err) {
      useUIStore.getState().showToast(`No se pudo actualizar: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  async function borrar(r: Resumen) {
    await borrarResumen(r)
    await recargar()
  }

  return {
    cargando: resumenes === null,
    errorCarga,
    resumenes: resumenes ?? [],
    periodos,
    periodo,
    setPeriodo,
    analisis,
    extras,
    conciliaciones,
    elegirTarjeta,
    agregarFaltantes,
    agregarCargos,
    pasarGastos,
    subida,
    subir,
    gruposRevision,
    editarEnRevision,
    comercios,
    recategorizar,
    confirmar,
    descartar,
    borrar,
  }
}
