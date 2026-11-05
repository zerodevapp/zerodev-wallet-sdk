import { Screen, type ThemeInput, TopNav } from '@zerodev/react-ui'
import { type ReactNode, useEffect } from 'react'
import { StatusScreen } from '../shared/components/StatusScreen'
import { useAuth } from './hooks/useAuth'
import { EmailVerification } from './pages/EmailVerification'
import { ErrorScreen } from './pages/ErrorScreen'
import { OtpInput } from './pages/OtpInput'
import { SignUp } from './pages/SignUp'
import { Verifying } from './pages/Verifying'
import { WalletConnecting } from './pages/WalletConnecting'
import type { AuthStep } from './types'
import { hasMagicLinkCodeInUrl, stripMagicLinkCodeFromUrl } from './utils/url'

function OAuthCallback() {
  return (
    <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center">
      <StatusScreen imageName="loading" title="Authenticating...">
        Please wait while we complete the OAuth authentication.
      </StatusScreen>
    </div>
  )
}

function PasskeyPrompt() {
  return (
    <div className="zd:flex zd:flex-1 zd:items-center zd:justify-center">
      <StatusScreen imageName="loading" title="Passkey authentication">
        Please authenticate with your passkey.
      </StatusScreen>
    </div>
  )
}

function renderStep(
  step: AuthStep | null,
  renderSignUp?: (() => ReactNode) | undefined,
): ReactNode {
  switch (step) {
    case 'sign-up':
      return renderSignUp ? renderSignUp() : <SignUp.Default />
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
    case 'wallet-connecting':
      return <WalletConnecting />
    case 'error':
      return <ErrorScreen />
    default:
      return null
  }
}

export function ConnectWallet({
  onClose: userOnClose,
  size,
  theme,
  renderSignUp,
  logo,
}: {
  onClose?: (() => void) | undefined
  size?: 'sm' | 'md' | 'lg' | undefined
  /** The theme: a preset name such as `'plain-dark'`, or mode, brand and
   * token overrides. Omitted, the card follows any theme an ancestor sets,
   * else the default (branded light). */
  theme?: ThemeInput | undefined
  /** Replace the default sign-up page: compose `SignUp.*` units inside
   * `<SignUp>`. Omit to render the canonical page (`SignUp.Default`). */
  renderSignUp?: (() => ReactNode) | undefined
  /** Optional brand logo for the sign-up page: a centred row under the top
   * nav, 32px tall in the design (e.g. `<ZeroDevLogo variant="lockup"
   * tone="auto" className="zd:h-8 zd:w-auto" />`). When omitted, no logo is
   * shown. `PoweredBy` always shows the ZeroDev mark independently. */
  logo?: ReactNode | undefined
} = {}) {
  const { step, goToStep, goBack, reset } = useAuth()

  useEffect(() => {
    if (step === null && hasMagicLinkCodeInUrl()) {
      goToStep('verifying-otp')
    }
  }, [step, goToStep])

  const content = renderStep(step, renderSignUp)
  if (!content) return null

  const handleClose = () => {
    stripMagicLinkCodeFromUrl()
    reset()
    userOnClose?.()
  }
  return (
    <Screen
      {...(size && { size })}
      {...(theme !== undefined && { theme })}
      // Sign-up shrinks to its content (few methods → shorter card) but never
      // grows past the standard height; other steps keep the fixed size.
      className={step === 'sign-up' ? 'zd:h-auto zd:max-h-202.5' : undefined}
      topNav={
        <TopNav
          {...(goBack !== null && { onLeftButtonClick: goBack })}
          onRightButtonClick={handleClose}
          {...(step === 'sign-up' && { className: 'zd:px-4' })}
        />
      }
    >
      {step === 'sign-up' && logo && (
        // The design's brand row: under the nav band, centred, 52px tall,
        // starting 20px up into the band's bottom padding, with 24px to the
        // title below.
        <div className="zd:-mt-5 zd:mb-6 zd:flex zd:h-13 zd:shrink-0 zd:items-center zd:justify-center">
          {logo}
        </div>
      )}
      {content}
    </Screen>
  )
}
