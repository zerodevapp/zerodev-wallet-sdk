import { useSendMagicLink } from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { StatusView } from '../../shared/components/StatusView'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

export function EmailVerification() {
  const { email, config: authConfig, setOtpId, goToStep } = useAuth()
  const { mutateAsync: sendMagicLink, isPending: isSendMagicLinkPending } =
    useSendMagicLink()

  const [secondsLeftUntilResend, setSecondsLeftUntilResend] = useState(60)
  const canResend = secondsLeftUntilResend <= 0 && !isSendMagicLinkPending

  useEffect(() => {
    if (secondsLeftUntilResend <= 0) return

    const timer = setInterval(() => {
      setSecondsLeftUntilResend((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [secondsLeftUntilResend])

  const handleResendOtp = async () => {
    if (!email || !canResend || !authConfig) return

    try {
      const { otpId } = await sendMagicLink({
        email,
        redirectURL: `${authConfig.magicLinkBaseUrl}/auth/verify-email?otp=%s&otpSource=email`,
      })
      setOtpId(otpId)
      setSecondsLeftUntilResend(60)
    } catch {
      // Error sending magic link
    }
  }

  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="flex flex-1 flex-col gap-8 justify-center h-full"
        >
          <StatusView
            imageName="send"
            title={'Check your email!\n An Email is On Its Way'}
          >
            We've sent a magic link to{' '}
            <Text className="text-solarOrange inline">{email}</Text>
            {'\n'}Please open the email and click the link to log in.
          </StatusView>

          <div className="flex flex-col gap-1">
            <Text className="text-center">
              Did not get an email?{' '}
              <button
                type="button"
                disabled={!canResend}
                onClick={handleResendOtp}
                className="cursor-pointer underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {canResend
                  ? 'Resend'
                  : `Resend in ${secondsLeftUntilResend} ${secondsLeftUntilResend === 1 ? 'second' : 'seconds'}`}
              </button>
            </Text>
            <Text className="text-center">
              Or{' '}
              <button
                type="button"
                onClick={() => goToStep('otp-input')}
                className="cursor-pointer underline"
              >
                sign in manually instead
              </button>
            </Text>
          </div>

          <AppLogo className="absolute self-center bottom-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
