/**
 * The Solana adapter: the kit's own slot (`solanaStoreSlice`) underneath.
 * Coupled to the EVM adapter on purpose (see `shared.ts`): connecting must
 * keep wagmi from adopting the same wallet's EVM side, and disconnecting
 * ends that side when nothing else is connected through it.
 */
import { connect as wagmiConnect } from '@wagmi/core'
import { useMemo } from 'react'
import { useStore } from 'zustand'
import { useWalletInfo } from '../auth/hooks/useWalletInfo.js'
import { AuthFlowDismissedError } from '../auth/utils/isCancellationError.js'
import {
  revokeDormantEvmSide,
  withoutEvmAdoption,
} from '../solana/evmAdoptionGuard.js'
import { useSolanaAutoReconnect } from '../solana/hooks/useSolanaAutoReconnect.js'
import { useSolanaWalletConnect } from '../solana/hooks/useSolanaWalletConnect.js'
import { useSolanaWallets } from '../solana/hooks/useSolanaWallets.js'
import { readLastSolanaWallet } from '../solana/solanaStoreSlice.js'
import type { SolanaStandardWallet } from '../solana/types.js'
import {
  type AdapterContext,
  endCompletedAuthFlow,
  kitConnectorOf,
} from './shared.js'
import type { KitAccountStatus, KitAdapter, KitConnectParams } from './types.js'

/**
 * Open the kit's sign-up flow and wait for it to connect a Solana wallet.
 * Resolves on the connection, rejects with `AuthFlowDismissedError` when the
 * flow closes without one.
 *
 * The flow can also end at `authenticated`: the host's sheet may carry
 * passkey, Google or email units beside the Solana ones, and the user may
 * pick one of those instead. That login is the user's choice, so it is
 * completed here (the kit connector's connect, which the sheet would
 * normally have been opened under), best effort; the Solana request then
 * settles as dismissed, like an EVM request that ended in a Solana
 * connection.
 */
function openSolanaSignUp({ store, config }: AdapterContext): Promise<void> {
  endCompletedAuthFlow(store)
  const auth = store.getState().auth
  if (auth.step !== null) {
    return Promise.reject(new Error('Auth flow already in progress'))
  }
  auth.goToStep('sign-up')
  const isConnected = () => store.getState().solana.connection !== null
  const completeLogin = async () => {
    try {
      await wagmiConnect(config, { connector: kitConnectorOf(config) })
    } catch {
      // The session exists, so a failure here is rare; a reload's reconnect
      // picks it up. The Solana request still settles below.
    }
  }
  return new Promise<void>((resolve, reject) => {
    const settle = (ok: boolean) => {
      unsubConnection()
      unsubStep()
      if (ok) resolve()
      else reject(new AuthFlowDismissedError())
    }
    const unsubConnection = store.subscribe(
      (s) => s.solana.connection,
      (connection) => {
        if (connection) settle(true)
      },
    )
    const unsubStep = store.subscribe(
      (s) => s.auth.step,
      (step) => {
        if (step === null) settle(isConnected())
        else if (step === 'authenticated') {
          completeLogin().finally(() => settle(isConnected()))
        }
      },
    )
  })
}

/** Solana only: keep wagmi from adopting the wallet's EVM side. */
async function connectSolanaWallet(
  { store, config }: AdapterContext,
  wallet: SolanaStandardWallet,
) {
  await withoutEvmAdoption(config, wallet.name, () =>
    store.getState().solana.connect(wallet),
  )
}

export function connectSolana(
  ctx: AdapterContext,
  { wallet }: KitConnectParams<'solana'> = {},
): Promise<void> {
  return wallet ? connectSolanaWallet(ctx, wallet) : openSolanaSignUp(ctx)
}

/**
 * Disconnect the Solana slot. A multichain wallet also granted its EVM side
 * in the Solana prompt; if nothing connected through that side it goes too,
 * or wagmi's reload reconnect would bring the user back as EVM.
 */
export async function disconnectSolana({
  store,
  config,
}: AdapterContext): Promise<void> {
  const walletName = store.getState().solana.connection?.wallet.name
  await store.getState().solana.disconnect()
  if (walletName) await revokeDormantEvmSide(config, walletName)
}

/**
 * The Solana side as the host reads it. Runs on every render of the kit
 * hook. With `restore`, mounts the silent reconnect after a reload and
 * reports the window before it has tried as `reconnecting`.
 */
export function useSolanaAdapter(
  ctx: AdapterContext,
  { restore }: { restore: boolean },
): KitAdapter<'solana'> {
  const { store, config } = ctx
  const sliceStatus = useStore(store, (s) => s.solana.status)
  const connection = useStore(store, (s) => s.solana.connection)
  const restoreSettled = useStore(store, (s) => s.solana.restoreSettled)
  const wallets = useSolanaWallets()
  const { walletInfo } = useWalletInfo('solana')
  const { enabled: walletConnect } = useSolanaWalletConnect(false)
  useSolanaAutoReconnect(restore)

  // A saved session that the auto-reconnect has not yet tried: the slot
  // still reads `disconnected` while the wallet registers or the
  // WalletConnect provider loads, so report that window as reconnecting.
  const restorePending =
    restore &&
    !restoreSettled &&
    sliceStatus === 'disconnected' &&
    readLastSolanaWallet() !== null
  const status: KitAccountStatus = restorePending ? 'reconnecting' : sliceStatus

  return useMemo(
    () => ({
      namespace: 'solana',
      status,
      isConnected: status === 'connected' && connection !== null,
      isReconnecting: status === 'reconnecting',
      address: connection?.address,
      walletInfo,
      wallets,
      walletConnect,
      connect: (params) => connectSolana({ store, config }, params),
      disconnect: () => disconnectSolana({ store, config }),
    }),
    [status, connection, walletInfo, wallets, walletConnect, store, config],
  )
}
