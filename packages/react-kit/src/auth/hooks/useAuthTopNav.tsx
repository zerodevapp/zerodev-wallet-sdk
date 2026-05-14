import { TopNav } from '../../shared/components/TopNav'
import { useAuthFlowContext } from '../AuthFlowContext'
import { useAuth } from './useAuth'

export function useAuthTopNav(title?: string) {
  const { step, goBack } = useAuth()
  const { onClose } = useAuthFlowContext()

  const showBack = step !== 'sign-up'

  return (
    <TopNav
      {...(showBack && { onBack: goBack })}
      onClose={onClose}
      {...(title && { title })}
    />
  )
}
