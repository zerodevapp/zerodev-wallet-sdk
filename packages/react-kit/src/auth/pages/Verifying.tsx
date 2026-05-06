import { useVerifyMagicLink } from '@zerodev/wallet-react'
import { useEffect, useRef, useState } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { Button } from '../../shared/components/Button'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { StatusView } from '../../shared/components/StatusView'
import { Text } from '../../shared/components/Text'
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
        <div className="flex flex-1 flex-col gap-8 items-center justify-center h-full">
          {isVerificationLoading && (
            <StatusView imageName="loading" title="Verifying Your Email">
              <Text>Please wait while we securely connect your wallet.</Text>
            </StatusView>
          )}

          {!code && !isVerificationLoading && (
            <StatusView imageName="error" title="Invalid Link">
              <Text>
                This verification link is invalid or incomplete.
                <br />
                Please check your email and try again with the correct link.
              </Text>
            </StatusView>
          )}

          {verificationError != null && (
            <>
              <StatusView imageName="error" title="Oops, something went wrong">
                <Text>
                  We couldn't complete the sign-in process. This could be due to
                  timeout, an expired link, or a cancelled request.
                </Text>
              </StatusView>
              <Button
                action="primary"
                onClick={() => goToStep('sign-up')}
                text="Choose another sign-in method"
              />
            </>
          )}

          <AppLogo className="self-center pb-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
