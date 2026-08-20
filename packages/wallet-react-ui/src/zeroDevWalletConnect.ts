import { walletConnect } from 'wagmi/connectors'

/**
 * WalletConnect connector preconfigured for the kit. `showQrModal: false` is
 * required — the kit renders its own pairing UI, and WalletConnect's bundled
 * Reown modal would pop over it otherwise.
 */
export function zeroDevWalletConnect({ projectId }: { projectId: string }) {
  if (!projectId) {
    throw new Error('zeroDevWalletConnect requires a WalletConnect projectId')
  }
  return walletConnect({ projectId, showQrModal: false })
}
