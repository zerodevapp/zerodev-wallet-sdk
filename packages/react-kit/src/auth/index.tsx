import { useEffect } from 'react'
import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import { StatusView } from '../shared/components/StatusView'
import { AuthFlowProvider } from './AuthFlowContext'
import { useAuth } from './hooks/useAuth'
import { useAuthTopNav } from './hooks/useAuthTopNav'
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
  const topNav = useAuthTopNav()
  return (
    <ScreenWrapper topNav={topNav}>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="flex flex-1 flex-col h-full items-center justify-center"
        >
          <StatusView imageName="loading" title="Authenticating...">
            Please wait while we complete the OAuth authentication.
          </StatusView>
        </div>
      )}
    </ScreenWrapper>
  )
}

function PasskeyPrompt() {
  const topNav = useAuthTopNav()
  return (
    <ScreenWrapper topNav={topNav}>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="flex flex-1 flex-col h-full items-center justify-center"
        >
          <StatusView imageName="loading" title="Passkey authentication">
            Please authenticate with your passkey.
          </StatusView>
        </div>
      )}
    </ScreenWrapper>
  )
}

function AuthFlowInner() {
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
      return <PasskeyPrompt />
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

export function AuthFlow({
  onClose,
}: {
  onClose?: (() => void) | undefined
} = {}) {
  return (
    <AuthFlowProvider userOnClose={onClose}>
      <AuthFlowInner />
    </AuthFlowProvider>
  )
}
