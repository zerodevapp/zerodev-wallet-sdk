import { useMemo } from 'react'
import { useAccount, useConfig, useConnectors } from 'wagmi'
import { useStore } from 'zustand'
import { useWalletInfo } from '../auth/hooks/useWalletInfo.js'
import { isZeroDevWalletConnect } from '../auth/utils/isZeroDevWalletConnect.js'
import { useKitStore } from '../shared/hooks/useKitStore.js'
import { useSolanaAutoReconnect } from '../solana/hooks/useSolanaAutoReconnect.js'
import { useSolanaWalletConnect } from '../solana/hooks/useSolanaWalletConnect.js'
import { useSolanaWallets } from '../solana/hooks/useSolanaWallets.js'
import { readLastSolanaWallet } from '../solana/solanaStoreSlice.js'
import { connect, disconnect } from './actions.js'
import type {
  KitAccountStatus,
  KitAdapter,
  KitNamespace,
  ZeroDevWalletKit,
  ZeroDevWalletKitOptions,
} from './types.js'

/**
 * The host-facing view of the kit. Every namespace is an adapter with the
 * same members (`status`, `address`, `wallets`, `connect`, `disconnect`, …)
 * and its own implementation behind them. Pick one with `namespace`, or
 * omit it for all of them side by side plus the cross-namespace
 * `connect({ namespace, … })` and `disconnect({ namespace? })`.
 *
 * EVM stays wagmi underneath (chains, balances, signing go through wagmi as
 * before); Solana signing goes through `useSolanaWallet()`. Requires the
 * `zeroDevWallet` connector on the wagmi config.
 */
export function useZeroDevWalletKit(
  options?: ZeroDevWalletKitOptions,
): ZeroDevWalletKit
export function useZeroDevWalletKit<NS extends KitNamespace>(
  options: ZeroDevWalletKitOptions & { namespace: NS },
): KitAdapter<NS>
export function useZeroDevWalletKit(
  options: ZeroDevWalletKitOptions & { namespace?: KitNamespace } = {},
): ZeroDevWalletKit | KitAdapter<KitNamespace> {
  const { namespace, reconnectOnMount = true } = options
  const store = useKitStore()
  const config = useConfig()
  const connectors = useConnectors()
  const evm = useAccount()
  const solanaSliceStatus = useStore(store, (s) => s.solana.status)
  const solanaConnection = useStore(store, (s) => s.solana.connection)
  const restoreSettled = useStore(store, (s) => s.solana.restoreSettled)
  const solanaWallets = useSolanaWallets()
  const { walletInfo: evmWalletInfo } = useWalletInfo('eip155')
  const { walletInfo: solanaWalletInfo } = useWalletInfo('solana')
  const { enabled: solanaWalletConnect } = useSolanaWalletConnect(false)
  // An EVM-only view has no Solana session to restore.
  const restoreSolana = reconnectOnMount && namespace !== 'eip155'
  useSolanaAutoReconnect(restoreSolana)

  // A saved session that the auto-reconnect has not yet tried: the slot
  // still reads `disconnected` while the wallet registers or the
  // WalletConnect provider loads, so report that window as reconnecting.
  const restorePending =
    restoreSolana &&
    !restoreSettled &&
    solanaSliceStatus === 'disconnected' &&
    readLastSolanaWallet() !== null
  const solanaStatus: KitAccountStatus = restorePending
    ? 'reconnecting'
    : solanaSliceStatus

  // Each adapter keeps its identity across the other's changes, so a host
  // can put `kit.solana` in effect deps.
  const eip155 = useMemo(
    (): KitAdapter<'eip155'> => ({
      namespace: 'eip155',
      status: evm.status,
      isConnected: evm.status === 'connected',
      isReconnecting: evm.status === 'reconnecting',
      address: evm.address,
      walletInfo: evmWalletInfo,
      // Only an EIP-6963 announcement proves a live extension: the generic
      // `injected()` connector and the kit's own embedded wallet (also type
      // "injected") exist regardless of installation.
      wallets: connectors.filter(
        (c) =>
          c.type === 'injected' &&
          c.id !== 'injected' &&
          c.id !== 'zerodev-wallet',
      ),
      walletConnect: connectors.some(isZeroDevWalletConnect),
      connect: (params = {}) =>
        connect(store, config, { namespace: 'eip155', ...params }),
      disconnect: () => disconnect(store, config, { namespace: 'eip155' }),
    }),
    [evm.status, evm.address, evmWalletInfo, connectors, store, config],
  )
  const solana = useMemo(
    (): KitAdapter<'solana'> => ({
      namespace: 'solana',
      status: solanaStatus,
      isConnected: solanaStatus === 'connected' && solanaConnection !== null,
      isReconnecting: solanaStatus === 'reconnecting',
      address: solanaConnection?.address,
      walletInfo: solanaWalletInfo,
      wallets: solanaWallets,
      walletConnect: solanaWalletConnect,
      connect: (params = {}) =>
        connect(store, config, { namespace: 'solana', ...params }),
      disconnect: () => disconnect(store, config, { namespace: 'solana' }),
    }),
    [
      solanaStatus,
      solanaConnection,
      solanaWalletInfo,
      solanaWallets,
      solanaWalletConnect,
      store,
      config,
    ],
  )

  const kit = useMemo(
    (): ZeroDevWalletKit => ({
      eip155,
      solana,
      isConnected: eip155.isConnected || solana.isConnected,
      isReconnecting: eip155.isReconnecting || solana.isReconnecting,
      connect: (params) => connect(store, config, params),
      disconnect: (params) => disconnect(store, config, params),
    }),
    [eip155, solana, store, config],
  )

  return namespace ? kit[namespace] : kit
}
