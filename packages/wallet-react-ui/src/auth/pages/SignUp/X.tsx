import { ListItem, ListItemChevron, ListItemIcon } from '@zerodev/react-ui'
import { useAuthenticateOAuth } from '@zerodev/wallet-react'
import { useAuth } from '../../hooks/useAuth'
import { isCancellationError } from '../../utils/isCancellationError'
import { useReportPending, useSignUpContext } from './context'

/** "X" OAuth row. */
export function SignUpX() {
  const { goToStep } = useAuth()
  const { authPending, guardAgreement, setError } = useSignUpContext()

  const { mutateAsync: authenticateOAuth, isPending } = useAuthenticateOAuth({
    mutation: {
      onSuccess: () => {
        goToStep('authenticated')
      },
    },
  })
  useReportPending(isPending)

  const handleClick = async () => {
    if (authPending) return
    if (!guardAgreement()) return
    setError(null)
    try {
      await authenticateOAuth({ provider: 'x' })
    } catch (err) {
      if (!isCancellationError(err)) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }

  return (
    <ListItem
      icon={<ListItemIcon name="xTwitter" />}
      title="X"
      trailing={<ListItemChevron />}
      disabled={authPending}
      onClick={handleClick}
    />
  )
}
