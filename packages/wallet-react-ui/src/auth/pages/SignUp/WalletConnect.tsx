import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
import { useConnectors } from 'wagmi'
import { walletConnectLogo } from '../../brandAssets'
import { isZeroDevWalletConnect } from '../../utils/isZeroDevWalletConnect'
import { useSignUpContext } from './context'

/** The WalletConnect list row, shared by the EVM and Solana units: logo, a
 * QR CODE badge (plus any namespace badge), and the page's pending and
 * consent guards around `onOpen`. */
export function WalletConnectRow({
  badge,
  onOpen,
}: {
  badge?: ReactNode
  onOpen: () => void
}) {
  const { authPending, guardAgreement } = useSignUpContext()
  return (
    <ListItem
      title="WalletConnect"
      icon={<img src={walletConnectLogo} alt="" className="zd:w-6 zd:h-6" />}
      subtitle={
        <span className="zd:flex zd:gap-1">
          {badge}
          <Badge text="QR CODE" />
        </span>
      }
      trailing={<ListItemChevron />}
      disabled={authPending}
      onClick={() => {
        if (authPending) return
        if (!guardAgreement()) return
        onOpen()
      }}
    />
  )
}

/** Generic WalletConnect row — opens the pairing sheet with a raw-URI QR any
 * wallet's scanner can claim. Renders nothing unless a `zeroDevWalletConnect`
 * connector is in the wagmi config. */
export function SignUpWalletConnect() {
  const { openWalletSheet } = useSignUpContext()
  const connectors = useConnectors()

  if (!connectors.some(isZeroDevWalletConnect)) return null

  return <WalletConnectRow onOpen={() => openWalletSheet()} />
}
