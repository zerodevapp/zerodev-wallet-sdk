import { type WalletConnectParameters, walletConnect } from 'wagmi/connectors'

/**
 * WalletConnect connector preconfigured for the kit. `showQrModal: false` is
 * required — the kit renders its own pairing UI, and WalletConnect's bundled
 * Reown modal would pop over it otherwise. All other WalletConnect
 * parameters (e.g. `metadata`) are forwarded as-is.
 *
 * The kit only pairs through connectors created here — a raw `walletConnect()`
 * in the config is ignored, since its `showQrModal` can't be read back.
 */
export function zeroDevWalletConnect(
  params: Omit<WalletConnectParameters, 'showQrModal'>,
) {
  if (!params.projectId) {
    throw new Error('zeroDevWalletConnect requires a WalletConnect projectId')
  }
  const create = walletConnect({ ...params, showQrModal: false })
  // Stamp the connector instance so the kit's discovery can tell a
  // correctly-configured connector from a raw walletConnect(), where
  // showQrModal defaults to true.
  return (config: Parameters<typeof create>[0]) => ({
    ...create(config),
    zdWalletConnect: true,
  })
}
