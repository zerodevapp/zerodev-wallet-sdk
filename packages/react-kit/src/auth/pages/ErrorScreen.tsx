import { AppLogo } from '../../shared/components/AppLogo'
import { Button } from '../../shared/components/Button'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { StatusView } from '../../shared/components/StatusView'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

interface ErrorScreenProps {
  title?: string
  message?: string
  showRetry?: boolean
  showChooseAnother?: boolean
}

export function ErrorScreen({
  title = 'Oops, something went wrong',
  message = "We couldn't complete the sign-in process. This could be due to timeout, an expired link, or a cancelled request.",
  showRetry = false,
  showChooseAnother = true,
}: ErrorScreenProps) {
  const { goToStep, goBack, reset } = useAuth()

  return (
    <ScreenWrapper>
      {() => (
        <div className="flex flex-1 flex-col gap-8 items-center justify-center h-full">
          <StatusView imageName="error" title={title}>
            <Text>{message}</Text>
          </StatusView>

          <div className="flex flex-col gap-1">
            {showRetry && (
              <Button action="primary" text="Try again" onClick={goBack} />
            )}
            {showChooseAnother && (
              <Button
                action={showRetry ? 'secondary' : 'primary'}
                onClick={() => goToStep('sign-up')}
                text="Choose another sign-in method"
              />
            )}
            {!showRetry && !showChooseAnother && (
              <Button action="primary" text="Start over" onClick={reset} />
            )}
          </div>

          <AppLogo className="absolute self-center bottom-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
