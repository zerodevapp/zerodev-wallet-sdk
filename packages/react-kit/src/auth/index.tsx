import { useEffect } from 'react'
import { StatusView } from '../shared/components/StatusView'
import { useAuth } from './hooks/useAuth'
import { EmailVerification } from './pages/EmailVerification'
import { ErrorScreen } from './pages/ErrorScreen'
import { OtpInput } from './pages/OtpInput'
import { SignUp } from './pages/SignUp'
import { Verifying } from './pages/Verifying'
import { WalletSelection } from './pages/WalletSelection'

function hasMagicLinkCodeInUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('code')
}

function OAuthCallback() {
  return (
    <StatusView imageName="loading" title="Authenticating...">
      Please wait while we complete the OAuth authentication.
    </StatusView>
  )
}

export function AuthFlow() {
  const { step, goToStep } = useAuth()

  useEffect(() => {
    if (step === 'initializing' && hasMagicLinkCodeInUrl()) {
      goToStep('verifying-otp')
    }
  }, [step, goToStep])

  switch (step) {
    case 'initializing':
      return null
    case 'sign-up':
      return <SignUp />
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
