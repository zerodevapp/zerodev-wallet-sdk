import type { ReactNode } from 'react'
import { BaseError } from 'viem'

import { AlertView } from '../../../shared/components/AlertView'
import { SigningActions } from '../SigningActions'

interface TxErrorInfo {
  title: string
  description: string
}

function getTxErrorInfo(error: Error): TxErrorInfo {
  const shortMessage = error instanceof BaseError ? error.shortMessage : null
  const message = error.message.toLowerCase()

  if (
    message.includes('insufficient funds') ||
    message.includes('transfer amount exceeds balance')
  ) {
    return {
      title: 'Insufficient funds',
      description:
        "You don't have enough funds to cover the amount plus gas fees.",
    }
  }

  return {
    title: 'Unable to process transaction',
    description: shortMessage ?? error.message,
  }
}

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
    <div className="flex flex-1 flex-col">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-2">
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
