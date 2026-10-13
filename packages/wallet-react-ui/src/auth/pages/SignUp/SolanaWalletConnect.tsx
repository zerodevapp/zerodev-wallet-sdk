import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useSolanaWalletConnect } from '../../../solana/hooks/useSolanaWalletConnect'
import { walletConnectLogo } from '../../brandAssets'
import { WalletSheet } from '../../components/WalletSheet'
import { useSolanaWalletConnectPairing } from '../../hooks/useSolanaWalletConnectPairing'
import { useSignUpContext } from './context'

/**
 * WalletConnect row for Solana wallets on another device (Phantom or
 * Solflare on a phone): opens a pairing sheet whose QR any Solana wallet's
 * scanner can claim. Renders nothing unless the wagmi config's
 * `zeroDevWalletConnect` has `solana: true`. The session lands in the kit's
 * Solana slot, beside any EVM connection, and restores silently on reload.
 */
export function SignUpSolanaWalletConnect() {
  const { authPending, guardAgreement, openSolanaWalletSheet } =
    useSignUpContext()
  const { enabled } = useSolanaWalletConnect()

  if (!enabled) return null

  const handleClick = () => {
    if (authPending) return
    if (!guardAgreement()) return
    openSolanaWalletSheet()
  }

  return (
    <ListItem
      title="WalletConnect"
      icon={<img src={walletConnectLogo} alt="" className="zd:w-6 zd:h-6" />}
      subtitle={
        <span className="zd:flex zd:gap-1">
          <Badge text="SOLANA" variant="secondary" />
          <Badge text="QR CODE" />
        </span>
      }
      trailing={<ListItemChevron />}
      disabled={authPending}
      onClick={handleClick}
    />
  )
}

/**
 * The root's Solana pairing sheet. The pairing hook lives in a child that
 * mounts only while the sheet is open, so a session is proposed when the
 * user asks for one and abandoned when they close the sheet.
 */
export function SolanaWalletConnectSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!open) return null
  return <OpenSheet onOpenChange={onOpenChange} />
}

function OpenSheet({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const pairing = useSolanaWalletConnectPairing()
  return (
    <WalletSheet
      open
      pairing={pairing}
      onOpenChange={onOpenChange}
      // A phone camera hands a wc: link to whichever app owns the scheme,
      // and MetaMask mobile does not settle a Solana session (checked
      // 2026-10-12), so the scan has to start inside a Solana wallet.
      hint="Scan with the in-app scanner of Phantom or Solflare. MetaMask does not connect Solana over WalletConnect."
    />
  )
}
