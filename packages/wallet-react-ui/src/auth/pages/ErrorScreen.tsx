import { Button, PoweredBy } from '@zerodev/react-ui'
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
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:items-center zd:justify-center">
        <StatusScreen imageName="error" title={title}>
          {message}
        </StatusScreen>

        <div className="zd:flex zd:flex-col zd:gap-1">
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

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
