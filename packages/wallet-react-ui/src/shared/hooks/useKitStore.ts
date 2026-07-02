import { useConfig } from 'wagmi'
import type { createStore } from '../../store'

type KitStore = ReturnType<typeof createStore>

/**
 * Returns the zustand store attached to the `zeroDevWallet` connector.
 * Throws when the kit connector isn't present on the wagmi config.
 *
 * Read individual fields with `useStore(useKitStore(), (s) => s.field)`.
 */
export function useKitStore(): KitStore {
  const config = useConfig()
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector || !('getKitStore' in connector)) {
    throw new Error('useKitStore must be used with the zeroDevWallet connector')
  }
  // @ts-expect-error - getKitStore is a custom method on the kit connector
  return connector.getKitStore()
}
