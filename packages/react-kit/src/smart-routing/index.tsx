import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'

import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import { TopNav } from '../shared/components/TopNav'
import { QrModal } from './components/QrModal'
import { useSmartRoutingFlow } from './hooks/useSmartRoutingFlow'
import { SelectNetwork } from './pages/SelectNetwork'
import { TransferFromWallet } from './pages/TransferFromWallet'
import type { SmartRoutingStep } from './types'

const TITLE_BY_STEP: Partial<Record<SmartRoutingStep, string>> = {
  'transfer-from-wallet': 'Transfer from wallet',
  'select-network': 'Select a network',
}

function renderStep(
  step: SmartRoutingStep | null,
  onGotIt: () => void,
  onShowQr: (address: string) => void,
  onSelectNetwork: () => void,
): ReactNode {
  switch (step) {
    case 'transfer-from-wallet':
      return (
        <TransferFromWallet
          onGotIt={onGotIt}
          onShowQr={onShowQr}
          onSelectNetwork={onSelectNetwork}
        />
      )
    case 'select-network':
      return <SelectNetwork />
    default:
      return null
  }
}

/**
 * Entry component for the Smart Routing Address (SRA) flow.
 *
 * Owns the `ScreenWrapper` + `TopNav` chrome and dispatches the current step
 * (from the kit's smart-routing store) to its page, mirroring `<AuthFlow>`.
 * Pages are pure content; navigation goes through `useSmartRoutingFlow`.
 */
export function SmartRoutingAddress({
  className,
  style,
  onClose: userOnClose,
}: {
  className?: string | undefined
  style?: CSSProperties | undefined
  onClose?: () => void
} = {}) {
  const { step, goToStep, goBack, reset } = useSmartRoutingFlow()
  const [qrAddress, setQrAddress] = useState<string | null>(null)

  // When the card mounts and no step is active, kick off the flow at its
  // landing page. The dashboard mounts the card conditionally, so this
  // effectively boots the flow on each open.
  useEffect(() => {
    if (step === null) goToStep('transfer-from-wallet')
  }, [step, goToStep])

  const handleClose = () => {
    reset()
    setQrAddress(null)
    userOnClose?.()
  }

  const handleCopyFromQr = async () => {
    if (!qrAddress) return
    await navigator.clipboard.writeText(qrAddress)
    setQrAddress(null)
  }

  const content = renderStep(step, handleClose, setQrAddress, () =>
    goToStep('select-network'),
  )
  if (!content) return null

  const title = step ? TITLE_BY_STEP[step] : undefined

  return (
    <ScreenWrapper
      {...(className && { className })}
      {...(style && { style })}
      topNav={
        <TopNav
          {...(goBack !== null && { onBack: goBack })}
          onClose={handleClose}
          {...(title && { title })}
        />
      }
      overlay={
        qrAddress ? (
          <QrModal
            address={qrAddress}
            onCopy={handleCopyFromQr}
            onClose={() => setQrAddress(null)}
          />
        ) : null
      }
    >
      {content}
    </ScreenWrapper>
  )
}
