import {
  connect as wagmiConnect,
  disconnect as wagmiDisconnect,
  reconnect as wagmiReconnect,
} from '@wagmi/core'
import { useCallback, useMemo } from 'react'
import { type Connector, useAccount, useConfig, useConnectors } from 'wagmi'
import { useStore } from 'zustand'
import { useWalletInfo, type WalletInfo } from '../auth/hooks/useWalletInfo.js'
import { AuthFlowDismissedError } from '../auth/utils/isCancellationError.js'
import { isZeroDevWalletConnect } from '../auth/utils/isZeroDevWalletConnect.js'
import { useKitStore } from '../shared/hooks/useKitStore.js'
import { equalsIgnoreCase } from '../shared/utils/common.js'
import {
  detachEvmConnection,
  withoutEvmAdoption,
} from '../solana/evmAdoptionGuard.js'
import { useSolanaAutoReconnect } from '../solana/hooks/useSolanaAutoReconnect.js'
import { useSolanaWalletConnect } from '../solana/hooks/useSolanaWalletConnect.js'
import { useSolanaWallets } from '../solana/hooks/useSolanaWallets.js'
import type { SolanaStandardWallet } from '../solana/types.js'
import type { createStore } from '../store.js'

/** The chain families the kit connects: EVM through wagmi, Solana through
 * the kit's own slot. CAIP-2 namespace ids, as AppKit uses them. */
export type KitNamespace = 'eip155' | 'solana'

export type KitAccountStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'

/** One namespace's connection, as the host reads it. */
export type KitAccount = {
  namespace: KitNamespace
  status: KitAccountStatus
  isConnected: boolean
  /** A silent restore after a reload is in flight: nothing is connected
   * yet, but nothing has been decided either. Hold any "signed out"
   * redirect while this is true. */
  isReconnecting: boolean
  /** Checksummed hex (EVM) or base58 (Solana); undefined while disconnected. */
  address: string | undefined
  /** Name, icon and source of the wallet behind the connection. */
  walletInfo: WalletInfo | undefined
}

export type KitConnectParams =
  | {
      namespace?: 'eip155'
      /** An installed EVM wallet from `wallets.eip155`. Omitted, the kit's
       * sign-up flow opens (passkey, Google, email, installed wallets, …)
       * and the promise follows it: resolved once an EVM wallet is
       * connected, rejected with `AuthFlowDismissedError` when the user
       * closes it. The host must render `ConnectWallet` for that. */
      wallet?: Connector
    }
  | {
      namespace: 'solana'
      /** A Solana wallet from `wallets.solana`, prompted directly. Omitted,
       * the sign-up flow opens with whatever Solana units the host
       * composed (`SignUp.InstalledWallets` with a `solana` namespace,
       * `SignUp.SolanaWalletConnect`), and the promise follows it the same
       * way as for EVM. */
      wallet?: SolanaStandardWallet
    }

export type KitDisconnectParams = {
  /** Disconnect one side and keep the other. Omitted, both go. */
  namespace?: KitNamespace
}

export type ZeroDevWalletKit = {
  eip155: KitAccount
  solana: KitAccount
  /** Either namespace is connected. */
  isConnected: boolean
  /** Either namespace is restoring a session after a reload. */
  isReconnecting: boolean
  /** Installed wallets the host can offer, per namespace: EVM wallets
   * announced through EIP-6963 (as wagmi connectors), Solana wallets from
   * the Wallet Standard registry. Live; empty during server rendering. */
  wallets: {
    eip155: readonly Connector[]
    solana: readonly SolanaStandardWallet[]
  }
  /** Whether a WalletConnect door is configured per namespace
   * (`zeroDevWalletConnect` on the wagmi config, with `solana: true` for
   * the Solana side). */
  walletConnect: { eip155: boolean; solana: boolean }
  connect: (params?: KitConnectParams) => Promise<void>
  disconnect: (params?: KitDisconnectParams) => Promise<void>
}

export type ZeroDevWalletKitOptions = {
  /** Restore the Solana session after a reload, the way wagmi's
   * `reconnectOnMount` restores the EVM one. Default `true`; set `false`
   * in a host that does not offer Solana. */
  reconnectOnMount?: boolean
}

type KitStore = ReturnType<typeof createStore>

/**
 * Open the kit's sign-up flow and wait for it to connect `namespace`.
 * Resolves on the first connection in that namespace, rejects with
 * `AuthFlowDismissedError` when the flow closes without one.
 */
function openSignUpFor(
  store: KitStore,
  isConnected: () => boolean,
  subscribeConnected: (onConnected: () => void) => () => void,
): Promise<void> {
  if (store.getState().auth.step !== null) {
    return Promise.reject(new Error('Auth flow already in progress'))
  }
  store.getState().auth.goToStep('sign-up')
  return new Promise<void>((resolve, reject) => {
    const settle = (ok: boolean) => {
      unsubConnected()
      unsubStep()
      if (ok) resolve()
      else reject(new AuthFlowDismissedError())
    }
    const unsubConnected = subscribeConnected(() => settle(true))
    const unsubStep = store.subscribe(
      (s) => s.auth.step,
      (step) => {
        if (step === null) settle(isConnected())
      },
    )
  })
}

/**
 * The host-facing view of the kit: both chain families' connections side by
 * side, with one `connect` and one `disconnect` that know the cross-namespace
 * rules. EVM stays wagmi underneath (chains, balances, signing go through
 * wagmi as before); Solana signing goes through `useSolanaWallet()`.
 *
 * `disconnect({ namespace: 'eip155' })` keeps Solana connected even when the
 * same multichain wallet (MetaMask, Phantom) serves both sides: wagmi's own
 * disconnect sends the wallet a permission revoke that such wallets apply to
 * the whole site, so that case is detached at wagmi's state level instead.
 * `connect({ namespace: 'solana', wallet })` connects Solana only, keeping
 * wagmi from adopting the wallet's EVM side in the same prompt.
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
  const solanaStatus = useStore(store, (s) => s.solana.status)
  const solanaConnection = useStore(store, (s) => s.solana.connection)
  const solanaWallets = useSolanaWallets()
  const { walletInfo: evmWalletInfo } = useWalletInfo('eip155')
  const { walletInfo: solanaWalletInfo } = useWalletInfo('solana')
  const { enabled: solanaWalletConnect } = useSolanaWalletConnect(false)
  useSolanaAutoReconnect(reconnectOnMount)

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

  // Only an EIP-6963 announcement proves a live extension: the generic
  // `injected()` connector and the kit's own embedded wallet (also type
  // "injected") exist regardless of installation.
  const evmWallets = useMemo(
    () =>
      connectors.filter(
        (c) =>
          c.type === 'injected' &&
          c.id !== 'injected' &&
          c.id !== 'zerodev-wallet',
      ),
    [connectors],
  )
  const evmWalletConnect = useMemo(
    () => connectors.some(isZeroDevWalletConnect),
    [connectors],
  )
  const wallets = useMemo(
    () => ({ eip155: evmWallets, solana: solanaWallets }),
    [evmWallets, solanaWallets],
  )
  const walletConnect = useMemo(
    () => ({ eip155: evmWalletConnect, solana: solanaWalletConnect }),
    [evmWalletConnect, solanaWalletConnect],
  )

  const connect = useCallback(
    async (params: KitConnectParams = {}) => {
      if (params.namespace === 'solana') {
        const { wallet } = params
        if (wallet) {
          await withoutEvmAdoption(config, wallet.name, () =>
            store.getState().solana.connect(wallet),
          )
          return
        }
        await openSignUpFor(
          store,
          () => store.getState().solana.connection !== null,
          (onConnected) =>
            store.subscribe(
              (s) => s.solana.connection,
              (connection) => {
                if (connection) onConnected()
              },
            ),
        )
        return
      }

      const { wallet } = params
      if (wallet) {
        // A multichain wallet that already authorised this site on the
        // Solana side also holds EVM accounts for it. wagmi's explicit
        // connect always asks the wallet for permissions again, which
        // MetaMask shows as a prompt; its reconnect path reads the
        // authorised accounts silently. Prompt only when that is empty.
        await config.storage?.removeItem(`${wallet.id}.disconnected`)
        const silent = await wagmiReconnect(config, { connectors: [wallet] })
        if (silent.length === 0)
          await wagmiConnect(config, { connector: wallet })
        return
      }

      // The kit connector's connect() opens the sign-up flow and resolves
      // once the embedded wallet is authenticated. An external EVM wallet
      // picked inside that flow connects through its own connector and
      // closes the flow, which the kit connector reports as a dismissal; an
      // EVM connection is there all the same, so that is a success.
      const kitConnector = config.connectors.find(
        (c) => c.id === 'zerodev-wallet',
      )
      if (!kitConnector) {
        throw new Error('useZeroDevWalletKit needs the zeroDevWallet connector')
      }
      try {
        await wagmiConnect(config, { connector: kitConnector })
      } catch (err) {
        if (
          err instanceof AuthFlowDismissedError &&
          config.state.status === 'connected'
        ) {
          return
        }
        throw err
      }
    },
    [config, store],
  )

  const disconnect = useCallback(
    async (params: KitDisconnectParams = {}) => {
      const { namespace } = params
      const disconnectSolana = () => store.getState().solana.disconnect()
      const disconnectEvm = async (keepSolana: boolean) => {
        const solanaWalletName = keepSolana
          ? store.getState().solana.connection?.wallet.name
          : undefined
        for (const { connector } of [...config.state.connections.values()]) {
          if (
            solanaWalletName &&
            equalsIgnoreCase(connector.name, solanaWalletName)
          ) {
            await detachEvmConnection(config, connector.uid)
          } else {
            await wagmiDisconnect(config, { connector })
          }
        }
      }

      if (namespace === 'eip155') {
        await disconnectEvm(store.getState().solana.connection !== null)
        return
      }
      if (namespace === 'solana') {
        await disconnectSolana()
        return
      }
      // Both go, so neither needs protecting from the other: a wallet-level
      // revoke that takes Solana down with it is the intended outcome. Each
      // side runs to the end even when the other fails.
      const results = await Promise.allSettled([
        disconnectEvm(false),
        disconnectSolana(),
      ])
      const failed = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      )
      if (failed) throw failed.reason
    },
    [config, store],
  )

  return useMemo(
    () => ({
      eip155,
      solana,
      isConnected: eip155.isConnected || solana.isConnected,
      isReconnecting: eip155.isReconnecting || solana.isReconnecting,
      wallets,
      walletConnect,
      connect,
      disconnect,
    }),
    [eip155, solana, wallets, walletConnect, connect, disconnect],
  )
}
