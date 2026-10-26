import type { Config, Connector } from 'wagmi'
import type { createStore } from '../store.js'

export type KitStore = ReturnType<typeof createStore>

/**
 * What every adapter works on. The adapters are coupled by design, not by
 * accident: one multichain wallet (MetaMask, Phantom) can serve both sides,
 * so each adapter reads the other's state through this shared store and
 * config before it connects or disconnects anything.
 */
export type AdapterContext = {
  store: KitStore
  config: Config
}

export function kitConnectorOf(config: Config): Connector {
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
export function endCompletedAuthFlow(store: KitStore): void {
  const auth = store.getState().auth
  if (auth.step === 'authenticated') auth.reset()
}
