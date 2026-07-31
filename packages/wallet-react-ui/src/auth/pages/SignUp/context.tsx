import { createContext, useContext, useEffect } from 'react'
import type { EmailAuthMethod } from '../../types'

export type SignUpContextValue = {
  /** True while any method's auth attempt is in flight — used to disable
   * sibling methods so two flows can't run at once. */
  authPending: boolean
  setAuthPending: (pending: boolean) => void
  /** Which email verification flow the Email unit runs. Set on the root
   * (`<SignUp emailAuthMethod=…>`); already resolved to its default here. */
  emailAuthMethod: EmailAuthMethod
  /** True when the terms checkbox is required but unchecked. For passive
   * disabled styling; use `guardAgreement` before starting an attempt. */
  needsAgreement: boolean
  /** Call before starting an auth attempt: highlights the terms checkbox and
   * returns false when agreement is required but missing. */
  guardAgreement: () => boolean
  setError: (message: string | null) => void
}

export const SignUpContext = createContext<SignUpContextValue | null>(null)

export function useSignUpContext(): SignUpContextValue {
  const ctx = useContext(SignUpContext)
  if (!ctx) {
    throw new Error('SignUp.* components must be rendered inside <SignUp>')
  }
  return ctx
}

/** Mirror a method's in-flight state into the shared pending flag.
 * Clears on unmount so a removed unit can't leave the page locked.
 * One flag, not per-unit: methods are mutually exclusive, so at most one
 * unit reports `true` at a time. */
export function useReportPending(pending: boolean) {
  const { setAuthPending } = useSignUpContext()
  useEffect(() => {
    setAuthPending(pending)
    return () => setAuthPending(false)
  }, [pending, setAuthPending])
}
