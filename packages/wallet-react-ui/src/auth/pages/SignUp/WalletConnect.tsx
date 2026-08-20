import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useConnectors } from 'wagmi'
import { walletConnectLogo } from '../../brandAssets'
import { isZeroDevWalletConnect } from '../../utils/isZeroDevWalletConnect'
import { useSignUpContext } from './context'

/** Generic WalletConnect row — opens the pairing sheet with a raw-URI QR any
 * wallet's scanner can claim. Renders nothing unless a `zeroDevWalletConnect`
 * connector is in the wagmi config. */
export function SignUpWalletConnect() {
  const { authPending, guardAgreement, openWalletSheet } = useSignUpContext()
  const connectors = useConnectors()

  if (!connectors.some(isZeroDevWalletConnect)) return null

  const handleClick = () => {
    if (authPending) return
    if (!guardAgreement()) return
    openWalletSheet()
  }

  return (
    <ListItem
      title="WalletConnect"
      icon={<img src={walletConnectLogo} alt="" className="zd:w-6 zd:h-6" />}
      subtitle={<Badge text="QR CODE" />}
      trailing={<ListItemChevron />}
      disabled={authPending}
      onClick={handleClick}
    />
  )
}
