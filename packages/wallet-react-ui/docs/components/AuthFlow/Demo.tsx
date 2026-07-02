import { AuthFlow } from '@zerodev/wallet-react-ui'
import { ConnectButton } from '../ConnectButton'

export default function AuthFlowDemo() {
  return (
    <div>
      <ConnectButton />
      <AuthFlow />
    </div>
  )
}
