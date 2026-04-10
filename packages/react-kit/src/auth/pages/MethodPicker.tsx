import { Button } from '../../shared/components/Button'
import { useAuth } from '../hooks/useAuth'
import type { AuthMethod, AuthStep } from '../types'

const METHOD_LABELS: Record<AuthMethod, string> = {
  email: 'Continue with Email',
  google: 'Continue with Google',
  passkey: 'Continue with Passkey',
  'injected-wallet': 'Continue with Wallet',
}

const METHOD_STEPS = {
  email: 'email-input',
  passkey: 'passkey-prompt',
  google: 'oauth-in-progress',
  'injected-wallet': 'wallet-selection',
} as const satisfies Record<AuthMethod, AuthStep>

export function MethodPicker() {
  const { enabledMethods, goToStep } = useAuth()

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold">Sign in or create account</h2>
        <p className="text-base text-gray-600">
          Select how you'd like to authenticate
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {enabledMethods.map((method) => (
          <Button
            key={method}
            text={METHOD_LABELS[method]}
            onClick={() => goToStep({ step: METHOD_STEPS[method] })}
            action="secondary"
          />
        ))}
      </div>
    </div>
  )
}
