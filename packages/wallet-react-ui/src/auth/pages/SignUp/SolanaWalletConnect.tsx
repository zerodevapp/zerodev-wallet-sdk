import { Badge } from '@zerodev/react-ui'
import { useSolanaWalletConnect } from '../../../solana/hooks/useSolanaWalletConnect'
import { WalletSheet } from '../../components/WalletSheet'
import { useSolanaWalletConnectPairing } from '../../hooks/useSolanaWalletConnectPairing'
import { useSignUpContext } from './context'
import { WalletConnectRow } from './WalletConnect'

/**
 * WalletConnect row for Solana wallets on another device: opens a pairing
 * sheet whose QR a Solana wallet's scanner can claim. Renders nothing unless
 * the wagmi config's `zeroDevWalletConnect` has `solana: true`. The session
 * lands in the kit's Solana slot, beside any EVM connection, and restores
 * silently on reload.
 */
export function SignUpSolanaWalletConnect() {
  const { openSolanaWalletSheet } = useSignUpContext()
  // `enabled` alone: the provider loads when the sheet opens, not before.
  const { enabled } = useSolanaWalletConnect(false)

  if (!enabled) return null

  return (
    <WalletConnectRow
      badge={<Badge text="SOLANA" variant="secondary" />}
      onOpen={openSolanaWalletSheet}
    />
  )
}

/**
 * The root's Solana pairing sheet. Always mounted, like the EVM one, so it
 * animates closed; the pairing runs only while open, so a session is
 * proposed when the user asks for one and abandoned when they close it.
 */
export function SolanaWalletConnectSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pairing = useSolanaWalletConnectPairing(open)
  return (
    <WalletSheet
      open={open}
      pairing={pairing}
      onOpenChange={onOpenChange}
      // A phone camera hands a wc: link to whichever app owns the scheme, so
      // the scan has to start inside a Solana wallet. A wallet that approves
      // without a Solana account is reported by the connect error itself.
      hint="Scan with the in-app scanner of a Solana wallet such as Phantom or Solflare."
    />
  )
}
