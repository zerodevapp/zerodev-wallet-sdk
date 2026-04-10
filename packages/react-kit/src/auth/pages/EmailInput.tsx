import { useSendOTP } from '@zerodev/wallet-react'
import { useState } from 'react'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { useAuth } from '../hooks/useAuth'

export function EmailInput() {
  const { goToStep, goBack } = useAuth()
  const [email, setEmail] = useState('')
  const { mutateAsync: sendOtp, isPending } = useSendOTP()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || isPending) return

    setError(null)
    try {
      const { otpId } = await sendOtp({ email })
      goToStep({ step: 'otp-input', otpId })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Enter your email</h2>
        <p className="text-base text-gray-600">
          We'll send you a verification code
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          disabled={isPending}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          text={isPending ? 'Sending...' : 'Continue'}
          disabled={!isValidEmail || isPending}
          action="primary"
        />

        <Button
          type="button"
          text="Back"
          onClick={goBack}
          action="secondary"
          disabled={isPending}
        />
      </form>
    </div>
  )
}
