import { useConfig } from 'wagmi'
import { useStore } from 'zustand'
import type { createStore } from '../../store'

type Store = ReturnType<typeof createStore>

function getKitStore(config: ReturnType<typeof useConfig>): Store | null {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) return null
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}

export function useSmartRoutingFlow() {
  const config = useConfig()
  const store = getKitStore(config)

  if (!store) {
    throw new Error(
      'useSmartRoutingFlow must be used with zeroDevWallet connector',
    )
  }

  const step = useStore(store, (state) => state.smartRouting.step)
  const stepHistory = useStore(store, (state) => state.smartRouting.stepHistory)
  const sendChain = useStore(store, (state) => state.smartRouting.sendChain)
  const receiveChain = useStore(
    store,
    (state) => state.smartRouting.receiveChain,
  )
  const editingChainSlot = useStore(
    store,
    (state) => state.smartRouting.editingChainSlot,
  )
  const sourceChains = useStore(
    store,
    (state) => state.smartRouting.config?.sourceChains,
  )
  const destinationChains = useStore(
    store,
    (state) => state.smartRouting.config?.destinationChains,
  )

  return {
    step,
    sendChain,
    receiveChain,
    editingChainSlot,
    sourceChains,
    destinationChains,
    goToStep: store.getState().smartRouting.goToStep,
    goBack:
      stepHistory.length > 1 ? store.getState().smartRouting.goBack : null,
    setEditingChainSlot: store.getState().smartRouting.setEditingChainSlot,
    setChain: store.getState().smartRouting.setChain,
    reset: store.getState().smartRouting.reset,
  }
}
