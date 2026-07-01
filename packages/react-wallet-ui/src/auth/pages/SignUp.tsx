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
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col gap-4 max-w-md">
          <Text className="text-h2 text-center">Error occurred</Text>
          <Text className="text-center text-red-500">{error}</Text>
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
    <div className="flex-1 flex flex-col justify-between pb-4 overflow-y-auto overflow-x-hidden">
      <div className="flex-1 flex flex-col justify-center">
        <div className="px-4 flex flex-col items-center">
          <div className="w-full px-16 py-4">
            <BlobAnimation className="w-full pointer-events-none select-none" />
          </div>
          <Text className="text-h2 text-center">Continue to your wallet</Text>
          <Text className="mt-2 text-center text-greyScale/50">
            Choose a sign-in method to proceed
          </Text>
        </div>
        <div className="mt-6 flex flex-col gap-4 mb-4">
          {enabledMethods.includes('passkey') && (
            <>
              <div className="px-4 flex flex-col gap-2">
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
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-greyScale/30" />
                <Text className="text-body3">or</Text>
                <div className="h-px flex-1 bg-greyScale/30" />
              </div>
            </>
          )}
          <div className="px-4 flex flex-col gap-2">
            {enabledMethods.includes('google') && (
              <ListItem
                iconName="google"
                title="Google"
                chevron
                className="rounded-3xl"
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
                containerClassName="rounded-3xl"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && emailInput && !anyPending) {
                    void handleEmailSubmit()
                  }
                }}
              >
                {isEmailLoading ? (
                  <div className="w-13 h-13 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-solarOrange border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      !isValidEmailAddress(emailInput) || needsToAcceptAgreement
                    }
                    className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-colors ${
                      isValidEmailAddress(emailInput) && !needsToAcceptAgreement
                        ? 'cursor-pointer'
                        : 'cursor-not-allowed opacity-50'
                    }`}
                    onClick={() => handleEmailSubmit()}
                  >
                    <Icon name="chevronRight" className="text-greyScale" />
                  </button>
                )}
              </Input>
            )}
          </div>
        </div>
      </div>
      <div className="px-4">
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
