import { useCallback, useMemo } from 'react'
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
  KitAccount,
  KitAccountStatus,
  KitConnectParams,
  KitDisconnectParams,
  ZeroDevWalletKit,
  ZeroDevWalletKitOptions,
} from './types.js'

/**
 * The host-facing view of the kit: both chain families' connections side by
 * side, with one `connect` and one `disconnect` that know the cross-namespace
 * rules (see `actions.ts`). EVM stays wagmi underneath (chains, balances,
 * signing go through wagmi as before); Solana signing goes through
 * `useSolanaWallet()`.
 *
 * Requires the `zeroDevWallet` connector on the wagmi config.
 */
export function useZeroDevWalletKit(
  options: ZeroDevWalletKitOptions = {},
): ZeroDevWalletKit {
  const { reconnectOnMount = true } = options
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
  useSolanaAutoReconnect(reconnectOnMount)

  // A saved session that the auto-reconnect has not yet tried: the slot
  // still reads `disconnected` while the wallet registers or the
  // WalletConnect provider loads, so report that window as reconnecting.
  const restorePending =
    reconnectOnMount &&
    !restoreSettled &&
    solanaSliceStatus === 'disconnected' &&
    readLastSolanaWallet() !== null
  const solanaStatus: KitAccountStatus = restorePending
    ? 'reconnecting'
    : solanaSliceStatus

  // Per-account objects keep their identity across unrelated changes, so a
  // host can put `kit.solana` in effect deps.
  const eip155 = useMemo(
    (): KitAccount => ({
      namespace: 'eip155',
      status: evm.status,
      isConnected: evm.status === 'connected',
      isReconnecting: evm.status === 'reconnecting',
      address: evm.address,
      walletInfo: evmWalletInfo,
    }),
    [evm.status, evm.address, evmWalletInfo],
  )
  const solana = useMemo(
    (): KitAccount => ({
      namespace: 'solana',
      status: solanaStatus,
      isConnected: solanaStatus === 'connected' && solanaConnection !== null,
      isReconnecting: solanaStatus === 'reconnecting',
      address: solanaConnection?.address,
      walletInfo: solanaWalletInfo,
    }),
    [solanaStatus, solanaConnection, solanaWalletInfo],
  )

  const connectKit = useCallback(
    (params?: KitConnectParams) => connect(store, config, params),
    [store, config],
  )
  const disconnectKit = useCallback(
    (params?: KitDisconnectParams) => disconnect(store, config, params),
    [store, config],
  )

  return useMemo(
    () => ({
      eip155,
      solana,
      isConnected: eip155.isConnected || solana.isConnected,
      isReconnecting: eip155.isReconnecting || solana.isReconnecting,
      wallets: {
        // Only an EIP-6963 announcement proves a live extension: the generic
        // `injected()` connector and the kit's own embedded wallet (also
        // type "injected") exist regardless of installation.
        eip155: connectors.filter(
          (c) =>
            c.type === 'injected' &&
            c.id !== 'injected' &&
            c.id !== 'zerodev-wallet',
        ),
        solana: solanaWallets,
      },
      walletConnect: {
        eip155: connectors.some(isZeroDevWalletConnect),
        solana: solanaWalletConnect,
      },
      connect: connectKit,
      disconnect: disconnectKit,
    }),
    [
      eip155,
      solana,
      connectors,
      solanaWallets,
      solanaWalletConnect,
      connectKit,
      disconnectKit,
    ],
  )
}
