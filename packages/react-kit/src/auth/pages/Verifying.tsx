import { useVerifyMagicLink } from '@zerodev/wallet-react'
import { useEffect, useRef, useState } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { Button } from '../../shared/components/Button'
import { StatusView } from '../../shared/components/StatusView'
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
    verifyMagicLink({
      otpId: otpId ?? '',
      code,
      otpEncryptionTargetBundle: otpEncryptionTargetBundle ?? '',
    })
  }, [otpId, otpEncryptionTargetBundle, code, verifyMagicLink])

  return (
    <>
      <div className="flex-1 flex flex-col gap-8 items-center justify-center">
        {!error && isVerificationLoading && (
          <StatusView imageName="loading" title="Verifying Your Email">
            Please wait while we securely connect your wallet.
          </StatusView>
        )}

        {!error && !code && !isVerificationLoading && (
          <>
            <StatusView imageName="error" title="Invalid Link">
              This verification link is invalid or incomplete.
              <br />
              Please check your email and try again with the correct link.
            </StatusView>
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
            <StatusView imageName="error" title="Oops, something went wrong">
              We couldn't complete the sign-in process. This could be due to
              timeout, an expired link, or a cancelled request.
            </StatusView>
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

      <AppLogo className="self-center pt-4 pb-6" />
    </>
  )
}
