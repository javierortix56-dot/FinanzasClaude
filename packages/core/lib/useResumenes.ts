// Estado de la vista "Resúmenes" (compartido por mobile y desktop; cada app
// pone su propia UI encima).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchMonthTransactions } from './analytics'
import { useTransactionStore } from '../store/useTransactionStore'
import { useUIStore } from '../store/useUIStore'
import { subscribeToCuotas } from './cuotas'
import { analizarPeriodo, mesesDeItems, noCargados } from './resumenAnalisis'
import { borrarResumen, cargarComoMovimiento, categoriasDeGasto, existeResumen, extraerResumen, fetchResumenes, guardarResumen } from './resumenes'
import {
  Reglas, agruparComercios, aplicarReglas, editarGrupo, fetchReglas, guardarReglas, recategorizarComercio, reglasDe,
} from './comercioReglas'
import { CompraCuotas, Currency, Resumen, ResumenItem, Settings, Transaction } from '../types'

export type EstadoSubida =
  | { paso: 'inactivo' }
  | { paso: 'leyendo'; archivo: string }
  | { paso: 'revisar'; resumen: Resumen; reemplaza: boolean }
  | { paso: 'guardando'; resumen: Resumen; reemplaza: boolean }
  | { paso: 'error'; mensaje: string }

export function useResumenes(s: Settings, base: Currency, creadoPor: string) {
  const [resumenes, setResumenes] = useState<Resumen[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [periodoElegido, setPeriodo] = useState<string | null>(null)
  const [txs, setTxs] = useState<Transaction[]>([])
  const [txsVersion, setTxsVersion] = useState(0)
  const [subida, setSubida] = useState<EstadoSubida>({ paso: 'inactivo' })
  // Cambios en los movimientos (alta, borrado, deshacer) refrescan "no cargados"
  const storeTxs = useTransactionStore((st) => st.transactions)
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

  const itemsPeriodo = useMemo(() => analisis?.resumenes.flatMap((r) => r.items) ?? [], [analisis])

  // Movimientos de la app en los meses que cubre el resumen (para "no cargados")
  useEffect(() => {
    const meses = mesesDeItems(itemsPeriodo)
    if (meses.length === 0) return
    let cancel = false
    Promise.all(meses.map(fetchMonthTransactions)).then((porMes) => {
      if (!cancel) setTxs(porMes.flat())
    })
    return () => { cancel = true }
  }, [itemsPeriodo, txsVersion, storeTxs])

  const faltantes = useMemo(() => noCargados(itemsPeriodo, txs), [itemsPeriodo, txs])

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

  async function cargar(item: ResumenItem, categoriaFallback: string) {
    await cargarComoMovimiento(item, categoriaFallback, creadoPor)
    setTxsVersion((v) => v + 1)
  }

  return {
    cargando: resumenes === null,
    errorCarga,
    resumenes: resumenes ?? [],
    periodos,
    periodo,
    setPeriodo,
    analisis,
    faltantes,
    subida,
    subir,
    gruposRevision,
    editarEnRevision,
    comercios,
    recategorizar,
    confirmar,
    descartar,
    borrar,
    cargar,
    refrescarMovimientos: () => setTxsVersion((v) => v + 1),
  }
}
