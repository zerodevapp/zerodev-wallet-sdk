import { StatusView } from '../../shared/components/StatusView'
import { useAuth } from '../hooks/useAuth'
import { EmailInput } from './EmailInput'
import { EmailVerification } from './EmailVerification'
import { ErrorScreen } from './ErrorScreen'
import { MethodPicker } from './MethodPicker'
import { OtpInput } from './OtpInput'
import { Verifying } from './Verifying'

// Placeholder components for OAuth and Wallet flows
function OAuthCallback() {
  return (
    <StatusView imageName="loading" title="Authenticating...">
      Please wait while we complete the OAuth authentication.
    </StatusView>
  )
}

function WalletSelection() {
  return (
    <StatusView imageName="loading" title="Select your wallet">
      Please select a wallet to continue.
    </StatusView>
  )
}

export function AuthFlow() {
  const { step } = useAuth()

  switch (step) {
    case 'initializing':
      return (
        <StatusView imageName="loading" title="Initializing...">
          Setting up authentication...
        </StatusView>
      )
    case 'select-method':
      return <MethodPicker />
    case 'all-methods':
      return <MethodPicker showAll />
    case 'email-input':
      return <EmailInput />
    case 'email-verification':
      return <EmailVerification />
    case 'otp-input':
      return <OtpInput />
    case 'verifying-otp':
      return <Verifying />
    case 'oauth-in-progress':
      return <OAuthCallback />
    case 'passkey-prompt':
      return (
        <StatusView imageName="loading" title="Passkey authentication">
          Please authenticate with your passkey.
        </StatusView>
      )
    case 'wallet-selection':
      return <WalletSelection />
    case 'authenticated':
      return null // consumer handles this via onSuccess callback
    case 'error':
      return <ErrorScreen />
    default:
      return null
  }
}
