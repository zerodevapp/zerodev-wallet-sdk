import { useState } from 'react'
import { Button } from '../../shared/components/Button'
import { CodeInput } from '../components/CodeInput'
import { useAuth } from '../hooks/useAuth'

export function OtpInput() {
  const { submitOtp, resendOtp, goBack, canResend, secondsUntilResend, email } =
    useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(false)

  const handleComplete = async (completedCode: string) => {
    setIsSubmitting(true)
    setError(false)
    try {
      await submitOtp(completedCode)
    } catch {
      setError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    await resendOtp()
    setError(false)
  }

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
          onChange={() => {
            setError(false)
          }}
          onComplete={handleComplete}
          disabled={isSubmitting}
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
          disabled={isSubmitting}
        />
      </div>
    </div>
  )
}
