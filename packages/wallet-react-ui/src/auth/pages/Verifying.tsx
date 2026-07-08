import { Button, PoweredBy } from '@zerodev/react-ui'
import { useVerifyMagicLink } from '@zerodev/wallet-react'
import { useEffect, useRef, useState } from 'react'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useAuth } from '../hooks/useAuth'
import { stripMagicLinkCodeFromUrl } from '../utils/url'

function getCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('code')
}

export function Verifying() {
  const {
    otpId,
    otpEncryptionTargetBundle,
    goToStep,
    clearOtpSession,
    config,
  } = useAuth()
  const [code] = useState<string | null>(getCodeFromUrl)
  const [error, setError] = useState<Error | null>(null)

  // ref to prevent useEffect firing twice in dev's StrictMode
  const hasVerifiedRef = useRef(false)
  const { mutate: verifyMagicLink, isPending: isVerificationLoading } =
    useVerifyMagicLink({
      mutation: {
        onSuccess: async () => {
          clearOtpSession()
          goToStep('authenticated')
          config?.onSuccess?.()
        },
        onError: (err) => {
          setError(err)
          config?.onError?.(err)
        },
      },
    })

  useEffect(() => {
    if (hasVerifiedRef.current || !code) return
    hasVerifiedRef.current = true

    // No active OTP session — most commonly the user tapped the same
    // magic link again after a successful verify, which cleared the
    // session. Skip the (doomed) mutation, clean the URL, and drop
    // back to step=null so the host app's own routing handles the
    // already-authenticated user without flashing an error.
    if (!otpId || !otpEncryptionTargetBundle) {
      stripMagicLinkCodeFromUrl()
      goToStep(null)
      return
    }

    verifyMagicLink({ otpId, code, otpEncryptionTargetBundle })
  }, [otpId, otpEncryptionTargetBundle, code, verifyMagicLink, goToStep])

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:items-center zd:justify-center">
        {!error && isVerificationLoading && (
          <StatusScreen imageName="loading" title="Verifying Your Email">
            Please wait while we securely connect your wallet.
          </StatusScreen>
        )}

        {!error && !code && !isVerificationLoading && (
          <>
            <StatusScreen imageName="error" title="Invalid Link">
              This verification link is invalid or incomplete.
              <br />
              Please check your email and try again with the correct link.
            </StatusScreen>
            <Button
              action="primary"
              onClick={() => {
                stripMagicLinkCodeFromUrl()
                goToStep('sign-up')
              }}
              text="Choose another sign-in method"
            />
          </>
        )}

        {error != null && (
          <>
            <StatusScreen imageName="error" title="Oops, something went wrong">
              We couldn't complete the sign-in process. This could be due to
              timeout, an expired link, or a cancelled request.
            </StatusScreen>
            <Button
              action="primary"
              onClick={() => {
                stripMagicLinkCodeFromUrl()
                goToStep('sign-up')
              }}
              text="Choose another sign-in method"
            />
          </>
        )}
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
