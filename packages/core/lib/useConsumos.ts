// Consumos reales desde un mes, con cambios en vivo (compartido por mobile y desktop)
import { useEffect, useState } from 'react'
import { subscribeToConsumos } from './consumos'
import { Consumo } from '../types'

export function useConsumos(desdeMes: string): Consumo[] | null {
  const [consumos, setConsumos] = useState<Consumo[] | null>(null)
  useEffect(() => {
    setConsumos(null)
    return subscribeToConsumos(desdeMes, setConsumos)
  }, [desdeMes])
  return consumos
}
