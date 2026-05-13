import { useVerifyMagicLink } from '@zerodev/wallet-react'
import { useEffect, useRef, useState } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { Button } from '../../shared/components/Button'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { StatusView } from '../../shared/components/StatusView'
import { useAuth } from '../hooks/useAuth'

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

  // ref to prevent useEffect firing twice in dev's StrictMode
  const hasVerifiedRef = useRef(false)
  const {
    mutate: verifyMagicLink,
    error: verificationError,
    isPending: isVerificationLoading,
  } = useVerifyMagicLink({
    mutation: {
      onSuccess: async () => {
        clearOtpSession()
        goToStep('authenticated')
        // Navigate the address bar off the magic-link landing URL so a
        // refresh doesn't re-trigger verification.
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', '/')
        }
        config?.onSuccess?.()
      },
      onError: (err) => {
        config?.onError?.(err)
      },
    },
  })

  useEffect(() => {
    if (hasVerifiedRef.current || !otpId || !otpEncryptionTargetBundle || !code)
      return

    hasVerifiedRef.current = true
    verifyMagicLink({ otpId, code, otpEncryptionTargetBundle })
  }, [otpId, otpEncryptionTargetBundle, code, verifyMagicLink])

  return (
    <ScreenWrapper>
      {() => (
        <div className="flex flex-1 flex-col h-full">
          <div className="flex-1 flex flex-col gap-8 items-center justify-center">
            {isVerificationLoading && (
              <StatusView imageName="loading" title="Verifying Your Email">
                Please wait while we securely connect your wallet.
              </StatusView>
            )}

            {!code && !isVerificationLoading && (
              <StatusView imageName="error" title="Invalid Link">
                This verification link is invalid or incomplete.
                <br />
                Please check your email and try again with the correct link.
              </StatusView>
            )}

            {verificationError != null && (
              <>
                <StatusView
                  imageName="error"
                  title="Oops, something went wrong"
                >
                  We couldn't complete the sign-in process. This could be due to
                  timeout, an expired link, or a cancelled request.
                </StatusView>
                <Button
                  action="primary"
                  onClick={() => goToStep('sign-up')}
                  text="Choose another sign-in method"
                />
              </>
            )}
          </div>

          <AppLogo className="self-center pt-4 pb-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
