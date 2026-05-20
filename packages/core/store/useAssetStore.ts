import { create } from 'zustand'
import { Asset } from '../types'

interface AssetState {
  assets: Asset[]
  isLoading: boolean
  setAssets: (assets: Asset[]) => void
  setLoading: (v: boolean) => void
}

export const useAssetStore = create<AssetState>((set) => ({
  assets: [],
  isLoading: true,
  setAssets: (assets) => set({ assets, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}))
