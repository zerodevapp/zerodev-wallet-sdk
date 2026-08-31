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
  const { otpId, otpEncryptionTargetBundle, goToStep, clearOtpSession } =
    useAuth()
  const [code] = useState<string | null>(getCodeFromUrl)
  const [error, setError] = useState<Error | null>(null)
  const [sessionMissing, setSessionMissing] = useState(false)

  // ref to prevent useEffect firing twice in dev's StrictMode
  const hasVerifiedRef = useRef(false)
  const { mutate: verifyMagicLink, isPending: isVerificationLoading } =
    useVerifyMagicLink({
      mutation: {
        onSuccess: () => {
          clearOtpSession()
          goToStep('authenticated')
        },
        onError: (err) => {
          setError(err)
        },
      },
    })

  useEffect(() => {
    if (hasVerifiedRef.current || !code) return
    hasVerifiedRef.current = true

    // No active OTP session — the link was already used, expired, or opened
    // in a browser that never started the email flow. Skip the (doomed)
    // mutation and show the expired-link error below instead of silently
    // dropping the step: a blank screen gives the user nothing to act on.
    // The already-authenticated re-tap case is covered too — hosts route
    // connected users away on their own (wagmi reconnect), so the error only
    // stays up for users who genuinely can't be verified.
    if (!otpId || !otpEncryptionTargetBundle) {
      setSessionMissing(true)
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

        {!error && sessionMissing && (
          <>
            <StatusScreen imageName="error" title="Link Expired">
              This verification link has expired or was already used.
              <br />
              Please sign in again to request a new one.
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

        {!error && !sessionMissing && !code && !isVerificationLoading && (
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
