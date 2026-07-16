import { Button, PoweredBy, Text } from '@zerodev/react-ui'
import { useSendOTP, useVerifyOTP } from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { CodeInput } from '../components/CodeInput'
import { useAuth } from '../hooks/useAuth'

export function OtpInput() {
  const {
    email,
    otpId,
    otpEncryptionTargetBundle,
    setOtpSession,
    clearOtpSession,
    goToStep,
    config,
  } = useAuth()
  const { mutateAsync: sendOtp, isPending: isSendOtpPending } = useSendOTP()
  const { mutateAsync: verifyOtp, isPending } = useVerifyOTP()

  const [otp, setOtp] = useState('')
  const [error, setError] = useState(false)
  const [secondsUntilResend, setSecondsUntilResend] = useState(60)

  // Countdown timer for resend
  useEffect(() => {
    if (secondsUntilResend <= 0) return

    const interval = setInterval(() => {
      setSecondsUntilResend((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [secondsUntilResend])

  const handleVerify = async () => {
    if (!otp.trim() || !otpId || !otpEncryptionTargetBundle) return

    setError(false)
    try {
      await verifyOtp({
        otpId,
        code: otp.trim(),
        otpEncryptionTargetBundle,
      })
      clearOtpSession()
      goToStep('authenticated')
      config?.onSuccess?.()
    } catch (err) {
      setError(true)
      config?.onError?.(err)
    }
  }

  const handleComplete = (code: string) => {
    setOtp(code)
  }

  const handleResend = async () => {
    if (!email || secondsUntilResend > 0 || isSendOtpPending) return

    try {
      const { otpId: newOtpId, otpEncryptionTargetBundle: newBundle } =
        await sendOtp({ email })
      setOtpSession({
        otpId: newOtpId,
        otpEncryptionTargetBundle: newBundle,
      })
      setSecondsUntilResend(60)
      setError(false)
    } catch {
      setError(true)
    }
  }

  const canResend = secondsUntilResend <= 0 && !isSendOtpPending

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:justify-center zd:items-center">
        <div className="zd:flex zd:flex-col zd:gap-4">
          <Text className="zd:text-h2 zd:text-center">
            Enter verification code
          </Text>
          <Text className="zd:text-center">
            Enter the code from the email we sent to{' '}
            <Text className="zd:text-solarOrange">{email}</Text>
          </Text>
        </div>

        <CodeInput
          onComplete={handleComplete}
          onChange={() => setError(false)}
          disabled={isPending}
          error={error}
          autoFocus
        />

        <Button
          text="Confirm code"
          onClick={handleVerify}
          disabled={!otp.trim() || isPending}
        />

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
                : `Resend in ${secondsUntilResend} ${secondsUntilResend === 1 ? 'second' : 'seconds'}`}
            </button>
          </Text>
        </div>
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
