import { Button } from '../../shared/components/Button'
import { StatusView } from '../../shared/components/StatusView'
import { useAuth } from '../hooks/useAuth'

export function EmailVerification() {
  const { email, goToStep, goBack } = useAuth()

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <StatusView imageName="send" title="Check your email">
        We sent a verification link to {email}. Click the link to continue, or
        enter the code manually.
      </StatusView>

      <div className="flex flex-col gap-3">
        <Button
          text="Enter code manually"
          onClick={() => goToStep({ step: 'otp-input' })}
          action="primary"
        />

        <Button text="Back" onClick={goBack} action="secondary" />
      </div>
    </div>
  )
}
