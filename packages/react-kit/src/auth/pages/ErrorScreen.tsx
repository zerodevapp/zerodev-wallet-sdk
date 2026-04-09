import { Button } from '../../shared/components/Button'
import { StatusView } from '../../shared/components/StatusView'
import { useAuth } from '../hooks/useAuth'

export function ErrorScreen() {
  const { error, goBack, reset } = useAuth()

  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <StatusView imageName="error" title="Something went wrong">
        {error?.message ?? 'An unexpected error occurred. Please try again.'}
      </StatusView>

      <div className="flex flex-col gap-3">
        {error?.recoverable ? (
          <Button text="Try again" onClick={goBack} action="primary" />
        ) : (
          <Button text="Start over" onClick={reset} action="primary" />
        )}
      </div>
    </div>
  )
}
