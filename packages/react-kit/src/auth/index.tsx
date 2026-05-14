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

function hasMagicLinkCodeInUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('code')
}

const TITLE_BY_STEP: Partial<Record<AuthStep, string>> = {
  'wallet-selection': 'Choose your wallet',
}

function OAuthCallback({ paddingTop }: { paddingTop: number }) {
  return (
    <div
      style={{ paddingTop: `${paddingTop}px` }}
      className="flex flex-1 flex-col h-full items-center justify-center"
    >
      <StatusView imageName="loading" title="Authenticating...">
        Please wait while we complete the OAuth authentication.
      </StatusView>
    </div>
  )
}

function PasskeyPrompt({ paddingTop }: { paddingTop: number }) {
  return (
    <div
      style={{ paddingTop: `${paddingTop}px` }}
      className="flex flex-1 flex-col h-full items-center justify-center"
    >
      <StatusView imageName="loading" title="Passkey authentication">
        Please authenticate with your passkey.
      </StatusView>
    </div>
  )
}

function getStepRenderer(
  step: AuthStep,
): ((paddingTop: number) => ReactNode) | null {
  switch (step) {
    case 'sign-up':
      return (paddingTop) => <SignUp paddingTop={paddingTop} />
    case 'email-verification':
      return (paddingTop) => <EmailVerification paddingTop={paddingTop} />
    case 'otp-input':
      return () => <OtpInput />
    case 'verifying-otp':
      return () => <Verifying />
    case 'oauth-in-progress':
      return (paddingTop) => <OAuthCallback paddingTop={paddingTop} />
    case 'passkey-prompt':
      return (paddingTop) => <PasskeyPrompt paddingTop={paddingTop} />
    case 'wallet-selection':
      return (paddingTop) => <WalletSelection paddingTop={paddingTop} />
    case 'error':
      return () => <ErrorScreen />
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
    if (step === 'initializing' && hasMagicLinkCodeInUrl()) {
      goToStep('verifying-otp')
    }
  }, [step, goToStep])

  const renderer = getStepRenderer(step)
  if (!renderer) return null

  const handleClose = () => {
    reset()
    userOnClose?.()
  }
  const title = TITLE_BY_STEP[step]
  const showBack = step !== 'sign-up'

  return (
    <ScreenWrapper
      topNav={
        <TopNav
          {...(showBack && { onBack: goBack })}
          onClose={handleClose}
          {...(title && { title })}
        />
      }
    >
      {({ paddingTop }) => renderer(paddingTop)}
    </ScreenWrapper>
  )
}
