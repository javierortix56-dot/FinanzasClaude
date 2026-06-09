import { create } from 'zustand'
import { Asset } from '../types'

interface AssetState {
  assets: Asset[]
  isLoading: boolean
  setAssets: (assets: Asset[]) => void
  setLoading: (v: boolean) => void
  /** Inserta o reemplaza un activo localmente (optimistic update). */
  upsertAsset: (asset: Asset) => void
  /** Elimina un activo localmente por id (optimistic update). */
  removeAsset: (id: string) => void
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: [],
  isLoading: true,
  setAssets: (assets) => set({ assets, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  upsertAsset: (asset) =>
    set((state) => {
      const idx = state.assets.findIndex((a) => a.id === asset.id)
      if (idx === -1) return { assets: [asset, ...state.assets] }
      const next = state.assets.slice()
      next[idx] = asset
      return { assets: next }
    }),
  removeAsset: (id) =>
    set((state) => ({ assets: state.assets.filter((a) => a.id !== id) })),
}))
