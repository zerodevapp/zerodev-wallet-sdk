import type { Chain } from 'viem'
import type { StateCreator } from 'zustand'
import type { SmartRoutingAddressConfig, SmartRoutingStep } from './types'

export type ChainSlot = 'send' | 'receive'

export interface SmartRoutingStoreSlice {
  smartRouting: {
    config: SmartRoutingAddressConfig | null
    step: SmartRoutingStep | null
    stepHistory: SmartRoutingStep[]
    /** Chain selected for the Send (source) row. */
    sendChain: Chain | null
    /** Chain selected for the Receive (destination) row. */
    receiveChain: Chain | null
    /**
     * Which chain row triggered the `select-network` step — read by
     * `SelectNetwork` to know which slot's chain to update on tap.
     */
    editingChainSlot: ChainSlot | null
    initialize: (config: SmartRoutingAddressConfig) => void
    goToStep: (step: SmartRoutingStep | null) => void
    goBack: () => void
    setEditingChainSlot: (slot: ChainSlot | null) => void
    setChain: (slot: ChainSlot, chain: Chain) => void
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
    sendChain: null,
    receiveChain: null,
    editingChainSlot: null,

    initialize: (config) => {
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          config,
          // Seed slot defaults to the first configured chain so the UI's
          // displayed chain matches the SRA hook's effective inputs. The
          // user can override either via `SelectNetwork`.
          sendChain: config.sourceChains?.[0] ?? state.smartRouting.sendChain,
          receiveChain:
            config.destinationChains?.[0] ?? state.smartRouting.receiveChain,
        },
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

    setEditingChainSlot: (slot) => {
      set((state) => ({
        smartRouting: { ...state.smartRouting, editingChainSlot: slot },
      }))
    },

    setChain: (slot, chain) => {
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          ...(slot === 'send' ? { sendChain: chain } : { receiveChain: chain }),
        },
      }))
    },

    reset: () => {
      set((state) => ({
        smartRouting: {
          ...state.smartRouting,
          step: null,
          stepHistory: [],
          sendChain: null,
          receiveChain: null,
          editingChainSlot: null,
        },
      }))
    },
  },
})
