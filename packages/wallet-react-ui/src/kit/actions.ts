import {
  connect as wagmiConnect,
  disconnect as wagmiDisconnect,
  reconnect as wagmiReconnect,
} from '@wagmi/core'
import type { Config, Connector } from 'wagmi'
import { AuthFlowDismissedError } from '../auth/utils/isCancellationError.js'
import { equalsIgnoreCase } from '../shared/utils/common.js'
import {
  detachEvmConnection,
  revokeDormantEvmSide,
  withoutEvmAdoption,
} from '../solana/evmAdoptionGuard.js'
import type { createStore } from '../store.js'
import type { KitConnectParams, KitDisconnectParams } from './types.js'

type KitStore = ReturnType<typeof createStore>

function kitConnectorOf(config: Config): Connector {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector) {
    throw new Error('useZeroDevWalletKit needs the zeroDevWallet connector')
  }
  return connector
}

/**
 * A passkey, Google or email login leaves the flow at its terminal
 * `authenticated` step for good. Before opening a new flow, end that one,
 * so the sheet does not carry a back arrow to a step that renders nothing.
 */
function endCompletedAuthFlow(store: KitStore): void {
  const auth = store.getState().auth
  if (auth.step === 'authenticated') auth.reset()
}

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
function openSolanaSignUp(store: KitStore, config: Config): Promise<void> {
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

/**
 * Open the kit's sign-up flow for an EVM login. The kit connector's connect()
 * opens the flow and resolves once the embedded wallet is authenticated. An
 * external EVM wallet picked inside that flow connects through its own
 * connector and closes the flow, which the kit connector reports as a
 * dismissal; an EVM connection is there all the same, so that is a success.
 */
async function openEvmSignUp(store: KitStore, config: Config): Promise<void> {
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
async function connectEvmWallet(
  config: Config,
  wallet: Connector,
): Promise<void> {
  await config.storage?.removeItem(`${wallet.id}.disconnected`)
  const silent = await wagmiReconnect(config, { connectors: [wallet] })
  if (silent.length === 0) await wagmiConnect(config, { connector: wallet })
}

export async function connect(
  store: KitStore,
  config: Config,
  params: KitConnectParams = {},
): Promise<void> {
  if (params.namespace === 'solana') {
    const { wallet } = params
    if (!wallet) return openSolanaSignUp(store, config)
    // Solana only: keep wagmi from adopting the wallet's EVM side.
    await withoutEvmAdoption(config, wallet.name, () =>
      store.getState().solana.connect(wallet),
    )
    return
  }
  const { wallet } = params
  if (!wallet) return openEvmSignUp(store, config)
  return connectEvmWallet(config, wallet)
}

/**
 * Disconnect the Solana slot. A multichain wallet also granted its EVM side
 * in the Solana prompt; if nothing connected through that side it goes too,
 * or wagmi's reload reconnect would bring the user back as EVM.
 */
async function disconnectSolana(store: KitStore, config: Config) {
  const walletName = store.getState().solana.connection?.wallet.name
  await store.getState().solana.disconnect()
  if (walletName) await revokeDormantEvmSide(config, walletName)
}

/**
 * Disconnect every EVM connection. With `keepSolana`, a connector that
 * serves the Solana slot too is detached at wagmi's state level instead of
 * disconnected: wagmi's own disconnect sends the wallet a permission revoke
 * that MetaMask applies to the whole site, Solana included.
 */
async function disconnectEvm(
  store: KitStore,
  config: Config,
  keepSolana: boolean,
) {
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

export async function disconnect(
  store: KitStore,
  config: Config,
  params: KitDisconnectParams = {},
): Promise<void> {
  const { namespace } = params
  if (namespace === 'eip155') {
    return disconnectEvm(
      store,
      config,
      store.getState().solana.connection !== null,
    )
  }
  if (namespace === 'solana') return disconnectSolana(store, config)
  // Both go, so neither needs protecting from the other: a wallet-level
  // revoke that takes Solana down with it is the intended outcome. Each side
  // runs to the end even when the other fails.
  const results = await Promise.allSettled([
    disconnectEvm(store, config, false),
    disconnectSolana(store, config),
  ])
  const failed = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  )
  if (failed) throw failed.reason
}
