import { useVerifyOTP } from '@zerodev/wallet-react'
import { useEffect } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { Button } from '../../shared/components/Button'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { StatusView } from '../../shared/components/StatusView'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

interface VerifyingProps {
  otp?: string
  otpSource?: 'input' | 'link'
}

export function Verifying({ otp, otpSource }: VerifyingProps) {
  const { otpId, otpEncryptionTargetBundle, goToStep, config } = useAuth()
  const {
    mutate: verifyOtp,
    error: verificationError,
    isPending: isVerificationLoading,
  } = useVerifyOTP({
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

  // Auto-verify when component mounts with OTP
  useEffect(() => {
    if (
      !otpId ||
      !otpEncryptionTargetBundle ||
      !otp ||
      isVerificationLoading ||
      verificationError
    )
      return

    verifyOtp({ otpId, code: otp, otpEncryptionTargetBundle })
  }, [
    otpId,
    otpEncryptionTargetBundle,
    otp,
    isVerificationLoading,
    verificationError,
    verifyOtp,
  ])

  return (
    <ScreenWrapper>
      {() => (
        <div className="flex flex-1 flex-col gap-8 items-center justify-center h-full">
          {isVerificationLoading && (
            <StatusView imageName="loading" title="Verifying Your Email">
              <Text>Please wait while we securely connect your wallet.</Text>
            </StatusView>
          )}

          {!otp && !isVerificationLoading && (
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
              <div className="flex flex-col gap-1">
                {otpSource === 'input' && (
                  <Button
                    action="primary"
                    text="Try again"
                    onClick={() => goToStep('otp-input')}
                  />
                )}
                <Button
                  action={otpSource === 'input' ? 'secondary' : 'primary'}
                  onClick={() => goToStep('sign-up')}
                  text="Choose another sign-in method"
                />
              </div>
            </>
          )}

          <AppLogo className="absolute self-center bottom-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
