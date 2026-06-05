import type { StateCreator } from 'zustand'
import type { SmartRoutingAddressConfig } from './types'

export interface SmartRoutingStoreSlice {
  smartRouting: {
    config: SmartRoutingAddressConfig | null
    initialize: (config: SmartRoutingAddressConfig) => void
  }
}

export const createSmartRoutingStoreSlice: StateCreator<
  SmartRoutingStoreSlice,
  [],
  [],
  SmartRoutingStoreSlice
> = (set) => ({
  smartRouting: {
    config: null,
    initialize: (config: SmartRoutingAddressConfig) => {
      set((state) => ({
        smartRouting: { ...state.smartRouting, config },
      }))
    },
  },
})
