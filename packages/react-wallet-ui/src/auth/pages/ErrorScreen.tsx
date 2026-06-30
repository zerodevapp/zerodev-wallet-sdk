import { Button } from '@zerodev/react-ui'
import { PoweredBy } from '../../shared/components/PoweredBy'
import { StatusScreen } from '../../shared/components/StatusScreen'
import { useAuth } from '../hooks/useAuth'
import { stripMagicLinkCodeFromUrl } from '../utils/url'

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
  const handleRetry = goBack ?? (() => goToStep('sign-up'))

  return (
    <>
      <div className="flex-1 flex flex-col gap-8 items-center justify-center">
        <StatusScreen imageName="error" title={title}>
          {message}
        </StatusScreen>

        <div className="flex flex-col gap-1">
          {showRetry && (
            <Button action="primary" text="Try again" onClick={handleRetry} />
          )}
          {showChooseAnother && (
            <Button
              action={showRetry ? 'secondary' : 'primary'}
              onClick={() => {
                stripMagicLinkCodeFromUrl()
                goToStep('sign-up')
              }}
              text="Choose another sign-in method"
            />
          )}
          {!showRetry && !showChooseAnother && (
            <Button action="primary" text="Start over" onClick={reset} />
          )}
        </div>
      </div>

      <PoweredBy className="self-center pt-4 pb-6" />
    </>
  )
}
