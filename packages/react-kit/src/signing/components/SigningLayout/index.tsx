import type { ReactNode } from 'react'

import { AlertView } from '../../../shared/components/AlertView'
import { getTxErrorInfo } from '../../utils/errors'
import { SigningActions } from '../SigningActions'

interface SigningLayoutProps {
  children: ReactNode
  onConfirm: () => void
  onReject: () => void
  disabled?: boolean
  error?: Error | null
}

export function SigningLayout({
  children,
  onConfirm,
  onReject,
  disabled,
  error,
}: SigningLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pb-2">
        {children}
        {!!error && <AlertView {...getTxErrorInfo(error)} />}
      </div>
      <SigningActions
        onConfirm={onConfirm}
        onReject={onReject}
        disabled={!!error || !!disabled}
      />
    </div>
  )
}
