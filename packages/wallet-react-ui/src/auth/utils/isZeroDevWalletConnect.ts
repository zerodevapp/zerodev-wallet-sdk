import type { Connector } from 'wagmi'

/** True for connectors created by `zeroDevWalletConnect` — the only ones the
 * kit pairs through. A raw `walletConnect()` may have `showQrModal` enabled
 * (its default), which can't be read back, so it's ignored. */
export function isZeroDevWalletConnect(connector: Connector) {
  return connector.type === 'walletConnect' && 'zdWalletConnect' in connector
}
