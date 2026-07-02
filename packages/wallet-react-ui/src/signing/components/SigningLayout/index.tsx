import { Callout } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
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
    <div className="zd:flex zd:flex-col zd:h-full">
      <div className="zd:flex-1 zd:min-h-0 zd:overflow-y-auto zd:flex zd:flex-col zd:gap-2 zd:pb-2">
        {children}
        {!!error && <Callout {...getTxErrorInfo(error)} />}
      </div>
      <SigningActions
        onConfirm={onConfirm}
        onReject={onReject}
        disabled={!!error || !!disabled}
      />
    </div>
  )
}
