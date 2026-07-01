import { AuthFlow } from '@zerodev/react-wallet-ui'
import { ConnectButton } from '../ConnectButton'

export default function AuthFlowDemo() {
  return (
    <div>
      <ConnectButton />
      <AuthFlow />
    </div>
  )
}
