import { AuthFlow } from '@zerodev/wallet-react-kit'
import { ConnectButton } from '../ConnectButton'

export default function AuthFlowDemo() {
  return (
    <div>
      <ConnectButton />
      <AuthFlow />
    </div>
  )
}
