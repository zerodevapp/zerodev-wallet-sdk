import { type CSSProperties, type ReactNode, useEffect } from 'react'

import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import { TopNav } from '../shared/components/TopNav'
import { useSmartRouting } from './hooks/useSmartRouting'
import { TransferFromWallet } from './pages/TransferFromWallet'
import type { SmartRoutingStep } from './types'

const TITLE_BY_STEP: Partial<Record<SmartRoutingStep, string>> = {
  'transfer-from-wallet': 'Transfer from wallet',
}

function renderStep(
  step: SmartRoutingStep | null,
  onGotIt: () => void,
): ReactNode {
  switch (step) {
    case 'transfer-from-wallet':
      return <TransferFromWallet onGotIt={onGotIt} />
    default:
      return null
  }
}

/**
 * Entry component for the Smart Routing Address (SRA) flow.
 *
 * Owns the `ScreenWrapper` + `TopNav` chrome and dispatches the current step
 * (from the kit's smart-routing store) to its page, mirroring `<AuthFlow>`.
 * Pages are pure content; navigation goes through `useSmartRouting`.
 */
export function SmartRoutingAddressCard({
  className,
  style,
  onClose: userOnClose,
}: {
  className?: string | undefined
  style?: CSSProperties | undefined
  onClose?: () => void
} = {}) {
  const { step, goToStep, reset } = useSmartRouting()

  // When the card mounts and no step is active, kick off the flow at its
  // landing page. The dashboard mounts the card conditionally, so this
  // effectively boots the flow on each open.
  useEffect(() => {
    if (step === null) goToStep('transfer-from-wallet')
  }, [step, goToStep])

  const handleClose = () => {
    reset()
    userOnClose?.()
  }

  const content = renderStep(step, handleClose)
  if (!content) return null

  const title = step ? TITLE_BY_STEP[step] : undefined

  return (
    <ScreenWrapper
      {...(className && { className })}
      {...(style && { style })}
      topNav={<TopNav onClose={handleClose} {...(title && { title })} />}
    >
      {content}
    </ScreenWrapper>
  )
}
