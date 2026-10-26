/**
 * The EVM adapter: wagmi underneath, with the rules a Solana slot beside it
 * imposes. Coupled to the Solana adapter on purpose (see `shared.ts`): a
 * disconnect has to know whether the same wallet also serves Solana.
 */
import {
  connect as wagmiConnect,
  disconnect as wagmiDisconnect,
  reconnect as wagmiReconnect,
} from '@wagmi/core'
import { useMemo } from 'react'
import { type Connector, useAccount, useConnectors } from 'wagmi'
import { useWalletInfo } from '../auth/hooks/useWalletInfo.js'
import { AuthFlowDismissedError } from '../auth/utils/isCancellationError.js'
import { isZeroDevWalletConnect } from '../auth/utils/isZeroDevWalletConnect.js'
import { equalsIgnoreCase } from '../shared/utils/common.js'
import { detachEvmConnection } from '../solana/evmAdoptionGuard.js'
import {
  type AdapterContext,
  endCompletedAuthFlow,
  kitConnectorOf,
} from './shared.js'
import type { KitAdapter, KitConnectParams } from './types.js'

/**
 * Open the kit's sign-up flow for an EVM login. The kit connector's connect()
 * opens the flow and resolves once the embedded wallet is authenticated. An
 * external EVM wallet picked inside that flow connects through its own
 * connector and closes the flow, which the kit connector reports as a
 * dismissal; an EVM connection is there all the same, so that is a success.
 */
async function openEvmSignUp({ store, config }: AdapterContext) {
  endCompletedAuthFlow(store)
  try {
    await wagmiConnect(config, { connector: kitConnectorOf(config) })
  } catch (err) {
    if (
      err instanceof AuthFlowDismissedError &&
      config.state.status === 'connected'
    ) {
      return
    }
    throw err
  }
}

/**
 * Connect an installed EVM wallet. A multichain wallet that already
 * authorised this site on the Solana side also holds EVM accounts for it.
 * wagmi's explicit connect always asks the wallet for permissions again,
 * which MetaMask shows as a prompt; its reconnect path reads the authorised
 * accounts silently. Prompt only when that is empty.
 */
async function connectEvmWallet({ config }: AdapterContext, wallet: Connector) {
  await config.storage?.removeItem(`${wallet.id}.disconnected`)
  const silent = await wagmiReconnect(config, { connectors: [wallet] })
  if (silent.length === 0) await wagmiConnect(config, { connector: wallet })
}

export function connectEvm(
  ctx: AdapterContext,
  { wallet }: KitConnectParams<'eip155'> = {},
): Promise<void> {
  return wallet ? connectEvmWallet(ctx, wallet) : openEvmSignUp(ctx)
}

/**
 * Disconnect every EVM connection. With `keepSolana`, a connector that
 * serves the Solana slot too is detached at wagmi's state level instead of
 * disconnected: wagmi's own disconnect sends the wallet a permission revoke
 * that MetaMask applies to the whole site, Solana included.
 */
export async function disconnectEvm(
  { store, config }: AdapterContext,
  keepSolana: boolean,
): Promise<void> {
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

/** The EVM side as the host reads it. Runs on every render of the kit hook. */
export function useEip155Adapter(ctx: AdapterContext): KitAdapter<'eip155'> {
  const { store, config } = ctx
  const evm = useAccount()
  const connectors = useConnectors()
  const { walletInfo } = useWalletInfo('eip155')
  return useMemo(
    () => ({
      namespace: 'eip155',
      status: evm.status,
      isConnected: evm.status === 'connected',
      isReconnecting: evm.status === 'reconnecting',
      address: evm.address,
      walletInfo,
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
      connect: (params) => connectEvm({ store, config }, params),
      // Keep Solana when it is connected through the same wallet.
      disconnect: () =>
        disconnectEvm(
          { store, config },
          store.getState().solana.connection !== null,
        ),
    }),
    [evm.status, evm.address, walletInfo, connectors, store, config],
  )
}
