import {
  useAuthenticateOAuth,
  useLoginPasskey,
  useRegisterPasskey,
  useSendMagicLink,
  useSendOTP,
} from '@zerodev/wallet-react'
import { useState } from 'react'
import { Button } from '../../shared/components/Button'
import { Icon } from '../../shared/components/Icon'
import { Input } from '../../shared/components/Input'
import { ListItem } from '../../shared/components/ListItem'
import { OrView } from '../../shared/components/OrView'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { SignUpFooter } from '../../shared/components/SignUpFooter'
import { Text } from '../../shared/components/Text'
import { isValidEmailAddress } from '../../shared/utils/common'
import { useAuth } from '../hooks/useAuth'

// Helper to check if error is due to user closing OAuth window
function isOAuthWindowClosedError(message: string): boolean {
  return (
    message.toLowerCase().includes('window') &&
    message.toLowerCase().includes('closed')
  )
}

export function SignUp() {
  const { goToStep, setEmail, setOtpSession, config, enabledMethods } =
    useAuth()
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [highlightAgreement, setHighlightAgreement] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const shouldUseOtp = config?.emailAuthMethod === 'otp'
  const { mutateAsync: sendOtp, isPending: isSendOtpPending } = useSendOTP()
  const { mutateAsync: sendMagicLink, isPending: isSendMagicLinkPending } =
    useSendMagicLink()
  const isEmailLoading = shouldUseOtp
    ? isSendOtpPending
    : isSendMagicLinkPending

  const [error, setError] = useState<string | null>(null)

  const { mutateAsync: authenticateOAuth, isPending: isGoogleLoading } =
    useAuthenticateOAuth({
      mutation: {
        onSuccess: async () => {
          goToStep('authenticated')
          config?.onSuccess?.()
        },
        onError: (err) => {
          config?.onError?.(err)
        },
      },
    })

  const { mutate: registerPasskey, isPending: isRegisterPasskeyPending } =
    useRegisterPasskey({
      mutation: {
        onSuccess: () => {
          goToStep('authenticated')
          config?.onSuccess?.()
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : String(err))
          config?.onError?.(err)
        },
      },
    })

  const { mutate: loginPasskey, isPending: isLoginPasskeyPending } =
    useLoginPasskey({
      mutation: {
        onSuccess: () => {
          goToStep('authenticated')
          config?.onSuccess?.()
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : String(err))
          config?.onError?.(err)
        },
      },
    })

  const anyPending =
    isGoogleLoading ||
    isEmailLoading ||
    isRegisterPasskeyPending ||
    isLoginPasskeyPending
  const requiresAgreement = !!(
    config?.termsAndConditionsUrl || config?.privacyPolicyUrl
  )
  const canContinue = !requiresAgreement || agreedToTerms

  const handleRegisterPasskey = () => {
    if (anyPending || !canContinue) return
    setError(null)
    registerPasskey()
  }

  const handleLoginPasskey = () => {
    if (anyPending || !canContinue) return
    setError(null)
    loginPasskey()
  }

  const handleGoogleAuth = async () => {
    if (!canContinue) return
    setError(null)
    try {
      await authenticateOAuth({ provider: 'google' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!isOAuthWindowClosedError(message)) {
        setError(message)
      }
    }
  }

  const handleChooseWallet = () => {
    goToStep('wallet-selection')
  }

  const handleEmailSubmit = async () => {
    if (!emailInput || anyPending) return
    if (!isValidEmailAddress(emailInput)) return
    if (!canContinue) {
      setHighlightAgreement(true)
      return
    }

    setError(null)
    try {
      const { otpId, otpEncryptionTargetBundle } = shouldUseOtp
        ? await sendOtp({ email: emailInput })
        : await sendMagicLink({
            email: emailInput,
            redirectURL: config?.magicLinkBaseUrl ?? '',
          })
      setEmail(emailInput)
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      goToStep(shouldUseOtp ? 'otp-input' : 'email-verification')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col gap-4 max-w-md">
          <Text className="text-h2 text-center">Error occurred</Text>
          <Text className="text-center text-red-500">{error}</Text>
        </div>
      </div>
    )
  }

  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="h-full flex flex-col justify-between pb-6 overflow-y-auto"
        >
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center gap-4">
              <Text className="text-h2 text-center">
                Continue to your wallet
              </Text>
              <Text className="text-center">
                Choose a sign-in method to proceed
              </Text>
            </div>
            <div className="mt-12 flex flex-col gap-2 mb-4">
              {enabledMethods.includes('passkey') && (
                <div className="flex flex-col gap-2">
                  <Button
                    action="secondaryNeutral"
                    text="Register a new passkey"
                    iconName="key"
                    trailIcon
                    disabled={anyPending}
                    onClick={handleRegisterPasskey}
                  />
                  <Text className="text-center">
                    Already got a passkey?{' '}
                    <button
                      type="button"
                      disabled={anyPending}
                      onClick={handleLoginPasskey}
                      className="text-greyScale my-2 cursor-pointer underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Login with passkey
                    </button>
                  </Text>
                </div>
              )}
              {enabledMethods.includes('google') && (
                <ListItem
                  iconName="google"
                  title="Google"
                  className="rounded-3xl"
                  disabled={anyPending}
                  onClick={handleGoogleAuth}
                />
              )}
              {enabledMethods.includes('email') && (
                <Input
                  iconName="email"
                  placeholder="Enter your email..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  disabled={anyPending}
                  variant="listItemStyle"
                  className="rounded-3xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailInput && !anyPending) {
                      handleEmailSubmit()
                    }
                  }}
                >
                  {emailInput && !anyPending ? (
                    <button
                      type="button"
                      className={`w-13 h-13 rounded-2xl bg-greyScale/[3%] flex items-center justify-center transition-colors ${
                        isValidEmailAddress(emailInput) && canContinue
                          ? 'cursor-pointer hover:bg-greyScale/[5%]'
                          : 'cursor-not-allowed opacity-50'
                      }`}
                      onClick={handleEmailSubmit}
                    >
                      <Icon name="chevronRight" className="text-greyScale" />
                    </button>
                  ) : isEmailLoading ? (
                    <div className="w-13 h-13 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-solarOrange border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : null}
                </Input>
              )}
              {enabledMethods.includes('injected-wallet') && (
                <>
                  <OrView />
                  <ListItem
                    iconName="walletOutline"
                    title="Choose a wallet instead"
                    disabled={anyPending}
                    onClick={handleChooseWallet}
                    chevron
                    className="rounded-3xl"
                  />
                </>
              )}
            </div>
          </div>
          <SignUpFooter
            termsAndConditionsUrl={config?.termsAndConditionsUrl}
            privacyPolicyUrl={config?.privacyPolicyUrl}
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={(agreed) => {
              setAgreedToTerms(agreed)
              if (agreed) setHighlightAgreement(false)
            }}
            highlight={highlightAgreement}
          />
        </div>
      )}
    </ScreenWrapper>
  )
}
