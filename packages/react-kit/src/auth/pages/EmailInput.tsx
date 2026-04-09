import { useState } from 'react'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { useAuth } from '../hooks/useAuth'

export function EmailInput() {
  const { submitEmail, goBack } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || isSubmitting) return

    setIsSubmitting(true)
    try {
      await submitEmail(email)
    } finally {
      setIsSubmitting(false)
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
          disabled={isSubmitting}
        />

        <Button
          type="submit"
          text={isSubmitting ? 'Sending...' : 'Continue'}
          disabled={!isValidEmail || isSubmitting}
          action="primary"
        />

        <Button
          type="button"
          text="Back"
          onClick={goBack}
          action="secondary"
          disabled={isSubmitting}
        />
      </form>
    </div>
  )
}
