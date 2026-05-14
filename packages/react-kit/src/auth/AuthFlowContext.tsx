import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react'
import { useAuth } from './hooks/useAuth'

interface AuthFlowContextValue {
  onClose: () => void
}

const AuthFlowContext = createContext<AuthFlowContextValue | null>(null)

export function AuthFlowProvider({
  userOnClose,
  children,
}: {
  userOnClose?: (() => void) | undefined
  children: ReactNode
}) {
  const { reset } = useAuth()

  const onClose = useCallback(() => {
    reset()
    userOnClose?.()
  }, [reset, userOnClose])

  const value = useMemo<AuthFlowContextValue>(() => ({ onClose }), [onClose])

  return (
    <AuthFlowContext.Provider value={value}>
      {children}
    </AuthFlowContext.Provider>
  )
}

export function useAuthFlowContext(): AuthFlowContextValue {
  const value = useContext(AuthFlowContext)
  if (!value) {
    throw new Error('useAuthFlowContext must be used inside <AuthFlow>')
  }
  return value
}
