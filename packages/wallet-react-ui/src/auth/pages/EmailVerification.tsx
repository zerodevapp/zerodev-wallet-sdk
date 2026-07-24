import { PoweredBy, Text } from '@zerodev/react-ui'
import { useSendMagicLink } from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useAuth } from '../hooks/useAuth'

export function EmailVerification() {
  const { email, setOtpSession } = useAuth()
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
      })
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      setSecondsLeftUntilResend(60)
    } catch {
      // Error resending magic link
    }
  }

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:justify-center">
        <StatusScreen
          imageName="send"
          title={'Check your email!\n An Email is On Its Way'}
        >
          We've sent a magic link to{' '}
          <Text as="span" className="zd:text-solarOrange">
            {email}
          </Text>
          {'\n'}Please open the email and click the link to log in.
        </StatusScreen>

        <div className="zd:flex zd:flex-col zd:gap-1">
          <Text className="zd:text-center">
            Did not get an email?{' '}
            <button
              type="button"
              disabled={!canResend}
              onClick={handleResend}
              className="zd:cursor-pointer zd:underline zd:disabled:opacity-50 zd:disabled:cursor-not-allowed"
            >
              {canResend
                ? 'Resend'
                : `Resend in ${secondsLeftUntilResend} ${secondsLeftUntilResend === 1 ? 'second' : 'seconds'}`}
            </button>
          </Text>
        </div>
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
