import { type ReactNode, useEffect } from 'react'
import { Screen } from '../shared/components/Screen'
import { StatusScreen } from '../shared/components/StatusScreen'
import { TopNav } from '../shared/components/TopNav'
import { useAuth } from './hooks/useAuth'
import { EmailVerification } from './pages/EmailVerification'
import { ErrorScreen } from './pages/ErrorScreen'
import { OtpInput } from './pages/OtpInput'
import { SignUp } from './pages/SignUp'
import { Verifying } from './pages/Verifying'
import { WalletSelection } from './pages/WalletSelection'
import type { AuthStep } from './types'
import { hasMagicLinkCodeInUrl, stripMagicLinkCodeFromUrl } from './utils/url'

const TITLE_BY_STEP: Partial<Record<AuthStep, string>> = {
  'wallet-selection': 'Choose your wallet',
}

function OAuthCallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <StatusScreen imageName="loading" title="Authenticating...">
        Please wait while we complete the OAuth authentication.
      </StatusScreen>
    </div>
  )
}

function PasskeyPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <StatusScreen imageName="loading" title="Passkey authentication">
        Please authenticate with your passkey.
      </StatusScreen>
    </div>
  )
}

function renderStep(step: AuthStep | null): ReactNode {
  switch (step) {
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
    case 'error':
      return <ErrorScreen />
    default:
      return null
  }
}

export function AuthFlow({
  onClose: userOnClose,
}: {
  onClose?: (() => void) | undefined
} = {}) {
  const { step, goToStep, goBack, reset } = useAuth()

  useEffect(() => {
    if (step === null && hasMagicLinkCodeInUrl()) {
      goToStep('verifying-otp')
    }
  }, [step, goToStep])

  const content = renderStep(step)
  if (!content) return null

  const handleClose = () => {
    stripMagicLinkCodeFromUrl()
    reset()
    userOnClose?.()
  }
  const title = step ? TITLE_BY_STEP[step] : undefined

  return (
    <Screen
      // Some elements in SignUp need to go from edge to edge.
      // No vertical padding; we set px-0 so we can fully control this padding.
      contentClassName={step === 'sign-up' ? 'px-0' : undefined}
      topNav={
        <TopNav
          {...(goBack !== null && { onBack: goBack })}
          onClose={handleClose}
          {...(title && { title })}
          {...(step === 'sign-up' && { centerLogo: true, className: 'px-4' })}
        />
      }
    >
      {content}
    </Screen>
  )
}
