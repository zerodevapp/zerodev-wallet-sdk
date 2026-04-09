import { Button } from '../../shared/components/Button'
import { useAuth } from '../hooks/useAuth'
import type { AuthMethod } from '../types'

interface MethodPickerProps {
  showAll?: boolean
}

const METHOD_LABELS: Record<AuthMethod, string> = {
  email: 'Continue with Email',
  google: 'Continue with Google',
  passkey: 'Continue with Passkey',
  'injected-wallet': 'Continue with Wallet',
}

export function MethodPicker({ showAll = false }: MethodPickerProps) {
  const { availableMethods, selectMethod } = useAuth()

  const displayMethods = showAll
    ? availableMethods
    : availableMethods.slice(0, 3)

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">
          {showAll ? 'Choose a method' : 'Sign in or create account'}
        </h2>
        <p className="text-base text-gray-600">
          Select how you'd like to authenticate
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {displayMethods.map((method) => (
          <Button
            key={method}
            text={METHOD_LABELS[method]}
            onClick={() => selectMethod(method)}
            action="secondary"
          />
        ))}
      </div>
    </div>
  )
}
