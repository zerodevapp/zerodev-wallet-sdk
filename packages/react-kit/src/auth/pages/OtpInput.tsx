import { useSendOTP, useVerifyOTP } from '@zerodev/wallet-react'
import { useEffect, useState } from 'react'
import { Button } from '../../shared/components/Button'
import { CodeInput } from '../components/CodeInput'
import { useAuth } from '../hooks/useAuth'

export function OtpInput() {
  const { email, otpId, setOtpId, goToStep, goBack, config } = useAuth()
  const { mutateAsync: sendOtp } = useSendOTP()
  const { mutateAsync: verifyOtp, isPending } = useVerifyOTP()

  const [error, setError] = useState(false)
  const [resendAvailableAt, setResendAvailableAt] = useState(Date.now() + 60000)
  const [secondsUntilResend, setSecondsUntilResend] = useState(60)

  // Countdown timer for resend
  useEffect(() => {
    if (!resendAvailableAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((resendAvailableAt - Date.now()) / 1000),
      )
      setSecondsUntilResend(remaining)
    }, 1000)
    return () => clearInterval(interval)
  }, [resendAvailableAt])

  const handleComplete = async (code: string) => {
    if (!otpId) return

    setError(false)
    try {
      await verifyOtp({ otpId, code })
      goToStep('authenticated')
      config?.onSuccess?.()
    } catch (err) {
      setError(true)
      config?.onError?.(err)
    }
  }

  const handleResend = async () => {
    if (!email || secondsUntilResend > 0) return

    try {
      const { otpId: newOtpId } = await sendOtp({ email })
      setOtpId(newOtpId)
      setResendAvailableAt(Date.now() + 60000)
      setError(false)
    } catch {
      setError(true)
    }
  }

  const canResend = secondsUntilResend <= 0

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Enter verification code</h2>
        <p className="text-base text-gray-600">
          We sent a 6-digit code to {email}
        </p>
      </div>

      <div className="flex flex-col gap-4 items-center">
        <CodeInput
          length={6}
          onChange={() => setError(false)}
          onComplete={handleComplete}
          disabled={isPending}
          error={error}
          autoFocus
        />

        {error && (
          <p className="text-sm text-red-500">
            Invalid code. Please try again.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          text={canResend ? 'Resend code' : `Resend in ${secondsUntilResend}s`}
          onClick={handleResend}
          disabled={!canResend}
          action="secondary"
        />

        <Button
          type="button"
          text="Back"
          onClick={goBack}
          action="secondary"
          disabled={isPending}
        />
      </div>
    </div>
  )
}
