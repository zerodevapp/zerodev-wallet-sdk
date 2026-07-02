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

/**
 * Reads the configurable brand logo passed via `zeroDevWallet({ config: { logo } })`.
 * Returns `null` when no logo was configured or the kit connector isn't present.
 */
export function useKitLogo() {
  const config = useConfig()
  const store = getKitStore(config)
  if (!store) {
    throw new Error('useKitLogo must be used with the zeroDevWallet connector')
  }
  return useStore(store, (state) => state.logo)
}
