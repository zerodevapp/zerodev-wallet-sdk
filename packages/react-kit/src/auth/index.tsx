import { type ReactNode, useEffect } from 'react'
import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import { StatusView } from '../shared/components/StatusView'
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
      <StatusView imageName="loading" title="Authenticating...">
        Please wait while we complete the OAuth authentication.
      </StatusView>
    </div>
  )
}

function PasskeyPrompt() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <StatusView imageName="loading" title="Passkey authentication">
        Please authenticate with your passkey.
      </StatusView>
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
    <ScreenWrapper
      topNav={
        <TopNav
          {...(goBack !== null && { onBack: goBack })}
          onClose={handleClose}
          {...(title && { title })}
        />
      }
    >
      {content}
    </ScreenWrapper>
  )
}
