import type { StateCreator } from 'zustand'
import type { SmartRoutingAddressConfig, SmartRoutingStep } from './types'

export interface SmartRoutingStoreSlice {
  smartRouting: {
    config: SmartRoutingAddressConfig | null
    step: SmartRoutingStep | null
    stepHistory: SmartRoutingStep[]
    initialize: (config: SmartRoutingAddressConfig) => void
    goToStep: (step: SmartRoutingStep | null) => void
    goBack: () => void
    reset: () => void
  }
}

export const createSmartRoutingStoreSlice: StateCreator<
  SmartRoutingStoreSlice,
  [],
  [],
  SmartRoutingStoreSlice
> = (set, get) => ({
  smartRouting: {
    config: null,
    step: null,
    stepHistory: [],

    initialize: (config) => {
      set((state) => ({
        smartRouting: { ...state.smartRouting, config },
      }))
    },

    goToStep: (step) => {
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          step,
          stepHistory:
            state.smartRouting.step === null
              ? state.smartRouting.stepHistory
              : [...state.smartRouting.stepHistory, state.smartRouting.step],
        },
      }))
    },

    goBack: () => {
      const { smartRouting } = get()
      if (smartRouting.stepHistory.length === 0) return
      const newHistory = [...smartRouting.stepHistory]
      const previousStep = newHistory.pop()!
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          step: previousStep,
          stepHistory: newHistory,
        },
      }))
    },

    reset: () => {
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          step: null,
          stepHistory: [],
        },
      }))
    },
  },
})
