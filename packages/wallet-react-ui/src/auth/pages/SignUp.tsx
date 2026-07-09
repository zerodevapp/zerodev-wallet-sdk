import { Button, Icon, Input, ListItem, Text } from '@zerodev/react-ui'
import {
  useAuthenticateOAuth,
  useLoginPasskey,
  useRegisterPasskey,
  useSendMagicLink,
  useSendOTP,
} from '@zerodev/wallet-react'
import { useState } from 'react'
import { SignUpFooter } from '../../shared/components/SignUpFooter'
import { isValidEmailAddress } from '../../shared/utils/common'
import { BlobAnimation } from '../components/BlobAnimation'
import { useAuth } from '../hooks/useAuth'

function isCancellationError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  // WebAuthn / passkey
  if (err.name === 'AbortError' || err.name === 'NotAllowedError') return true
  // OAuth (existing logic, message-based)
  const msg = err.message.toLowerCase()
  return msg.includes('oauth popup was closed')
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
  const isEmailLoading = isSendOtpPending || isSendMagicLinkPending

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
          if (!isCancellationError(err)) {
            setError(err instanceof Error ? err.message : String(err))
          }
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
          if (!isCancellationError(err)) {
            setError(err instanceof Error ? err.message : String(err))
          }
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
  const needsToAcceptAgreement = requiresAgreement && !agreedToTerms

  const handleRegisterPasskey = () => {
    if (anyPending) return
    if (needsToAcceptAgreement) {
      setHighlightAgreement(true)
      return
    }
    setError(null)
    registerPasskey()
  }

  const handleLoginPasskey = () => {
    if (anyPending) return
    if (needsToAcceptAgreement) {
      setHighlightAgreement(true)
      return
    }
    setError(null)
    loginPasskey()
  }

  const handleGoogleAuth = async () => {
    if (needsToAcceptAgreement) {
      setHighlightAgreement(true)
      return
    }
    setError(null)
    try {
      await authenticateOAuth({ provider: 'google' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!isCancellationError(err)) {
        setError(message)
      }
    }
  }

  const handleEmailOtp = async () => {
    if (!emailInput || anyPending) return
    if (!isValidEmailAddress(emailInput)) return
    if (needsToAcceptAgreement) {
      setHighlightAgreement(true)
      return
    }

    setError(null)
    try {
      const { otpId, otpEncryptionTargetBundle } = await sendOtp({
        email: emailInput,
      })
      setEmail(emailInput)
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      goToStep('otp-input')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  const handleEmailMagicLink = async () => {
    if (!emailInput || anyPending) return
    if (!isValidEmailAddress(emailInput)) return
    if (needsToAcceptAgreement) {
      setHighlightAgreement(true)
      return
    }

    setError(null)
    try {
      const { otpId, otpEncryptionTargetBundle } = await sendMagicLink({
        email: emailInput,
      })
      setEmail(emailInput)
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      goToStep('email-verification')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  const handleEmailSubmit = shouldUseOtp ? handleEmailOtp : handleEmailMagicLink

  if (error) {
    return (
      <div className="zd:flex zd:items-center zd:justify-center zd:h-full">
        <div className="zd:flex zd:flex-col zd:gap-4 zd:max-w-md">
          <Text className="zd:text-h2 zd:text-center">Error occurred</Text>
          <Text className="zd:text-center zd:text-red-500">{error}</Text>
          <Button
            action="primary"
            text="Try again"
            onClick={() => setError(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="zd:flex-1 zd:flex zd:flex-col zd:justify-between zd:pb-4 zd:overflow-y-auto zd:overflow-x-hidden">
      <div className="zd:flex-1 zd:flex zd:flex-col zd:justify-center">
        <div className="zd:px-4 zd:flex zd:flex-col zd:items-center">
          <div className="zd:w-full zd:px-16 zd:py-4">
            <BlobAnimation className="zd:w-full zd:pointer-events-none zd:select-none" />
          </div>
          <Text className="zd:text-h2 zd:text-center">
            Continue to your wallet
          </Text>
          <Text className="zd:mt-2 zd:text-center zd:text-greyScale/50">
            Choose a sign-in method to proceed
          </Text>
        </div>
        <div className="zd:mt-6 zd:flex zd:flex-col zd:gap-4 zd:mb-4">
          {enabledMethods.includes('passkey') && (
            <>
              <div className="zd:px-4 zd:flex zd:flex-col zd:gap-2">
                <Button
                  action="secondary"
                  text="Create a passkey"
                  iconName="key"
                  trailIcon
                  disabled={anyPending}
                  onClick={handleRegisterPasskey}
                />
                <Button
                  action="secondary"
                  text="Log in with passkey"
                  iconName="key"
                  trailIcon
                  disabled={anyPending}
                  onClick={handleLoginPasskey}
                />
              </div>
              <div className="zd:flex zd:items-center zd:gap-3">
                <div className="zd:h-px zd:flex-1 zd:bg-greyScale/30" />
                <Text className="zd:text-body3">or</Text>
                <div className="zd:h-px zd:flex-1 zd:bg-greyScale/30" />
              </div>
            </>
          )}
          <div className="zd:px-4 zd:flex zd:flex-col zd:gap-2">
            {enabledMethods.includes('google') && (
              <ListItem
                iconName="google"
                title="Google"
                chevron
                className="zd:rounded-3xl"
                disabled={anyPending}
                onClick={handleGoogleAuth}
              />
            )}
            {enabledMethods.includes('email') && (
              <Input
                iconName="email"
                placeholder="Enter your email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                disabled={anyPending}
                variant="listItemStyle"
                containerClassName="zd:rounded-3xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailInput && !anyPending) {
                    handleEmailSubmit()
                  }
                }}
              >
                {isEmailLoading ? (
                  <div className="zd:w-13 zd:h-13 zd:flex zd:items-center zd:justify-center">
                    <div className="zd:w-5 zd:h-5 zd:border-2 zd:border-solarOrange zd:border-t-transparent zd:rounded-full zd:animate-spin" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      !isValidEmailAddress(emailInput) || needsToAcceptAgreement
                    }
                    className={`zd:w-13 zd:h-13 zd:rounded-2xl zd:flex zd:items-center zd:justify-center zd:transition-colors ${
                      isValidEmailAddress(emailInput) && !needsToAcceptAgreement
                        ? 'zd:cursor-pointer'
                        : 'zd:cursor-not-allowed zd:opacity-50'
                    }`}
                    onClick={() => handleEmailSubmit()}
                  >
                    <Icon name="chevronRight" className="zd:text-greyScale" />
                  </button>
                )}
              </Input>
            )}
          </div>
        </div>
      </div>
      <div className="zd:px-4">
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
    </div>
  )
}
