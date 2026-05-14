import { useSendMagicLink } from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { AppLogo } from '../../shared/components/AppLogo'
import { StatusView } from '../../shared/components/StatusView'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

export function EmailVerification() {
  const { email, setOtpSession, config } = useAuth()
  const { mutateAsync: sendMagicLink, isPending: isSendPending } =
    useSendMagicLink()

  const [secondsLeftUntilResend, setSecondsLeftUntilResend] = useState(60)
  const canResend = secondsLeftUntilResend <= 0 && !isSendPending

  useEffect(() => {
    if (secondsLeftUntilResend <= 0) return

    const timer = setInterval(() => {
      setSecondsLeftUntilResend((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [secondsLeftUntilResend])

  const handleResend = async () => {
    if (!email || !canResend) return

    try {
      const { otpId, otpEncryptionTargetBundle } = await sendMagicLink({
        email,
        redirectURL: config?.magicLinkBaseUrl ?? '',
      })
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      setSecondsLeftUntilResend(60)
    } catch {
      // Error resending magic link
    }
  }

  return (
    <>
      <div className="flex-1 flex flex-col gap-8 justify-center">
        <StatusView
          imageName="send"
          title={'Check your email!\n An Email is On Its Way'}
        >
          We've sent a magic link to{' '}
          <Text as="span" className="text-solarOrange">
            {email}
          </Text>
          {'\n'}Please open the email and click the link to log in.
        </StatusView>

        <div className="flex flex-col gap-1">
          <Text className="text-center">
            Did not get an email?{' '}
            <button
              type="button"
              disabled={!canResend}
              onClick={handleResend}
              className="cursor-pointer underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canResend
                ? 'Resend'
                : `Resend in ${secondsLeftUntilResend} ${secondsLeftUntilResend === 1 ? 'second' : 'seconds'}`}
            </button>
          </Text>
        </div>
      </div>

      <AppLogo className="self-center pt-4 pb-6" />
    </>
  )
}
