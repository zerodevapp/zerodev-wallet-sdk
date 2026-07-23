import { Screen, TopNav } from '@zerodev/react-ui'
import { type ReactNode, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { QrSheet } from '../components/QrSheet'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { Deposit } from './Deposit'
import { PastDeposits } from './PastDeposits'

/**
 * Steps rendered by `SmartRoutingAddress`. Sub-views advance/rewind local
 * step state; the widget owns navigation and the `TopNav` chrome accordingly.
 */
export type SmartRoutingAddressStep = 'deposit' | 'past'

const TITLE_BY_STEP: Record<SmartRoutingAddressStep, string> = {
  deposit: 'Deposit funds',
  past: 'Past deposits',
}

function renderStep(
  step: SmartRoutingAddressStep,
  {
    onQrClick,
    onViewPastDeposits,
  }: {
    onQrClick?: (() => void) | undefined
    onViewPastDeposits?: (() => void) | undefined
  },
): ReactNode {
  switch (step) {
    case 'deposit':
      return (
        <Deposit
          {...(onQrClick && { onQrClick })}
          {...(onViewPastDeposits && { onViewPastDeposits })}
        />
      )
    case 'past':
      return <PastDeposits />
    default:
      return null
  }
}

/**
 * The Figma "Deposit funds" flow (`17634:104268` / `18721:96092`).
 *
 * Owns the shared `Screen` + `TopNav` chrome and delegates the body to the
 * current page in this directory. Mirrors the layout of `wallet-react-ui`'s
 * `auth/index.tsx` and `signing/index.tsx`.
 *
 * Wrap the subtree with `<SmartRoutingAddressProvider config={…}>` first.
 */
export interface SmartRoutingAddressProps {
  /** Recipient address the smart routing address is created for. */
  recipient: Address
  /** Called when the top-right × close button is clicked. */
  onClose: () => void
  /** Called when the top-left ? help button is clicked on the deposit step. */
  onHelp?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function SmartRoutingAddress({
  recipient,
  onClose,
  onHelp,
  className,
  size,
}: SmartRoutingAddressProps) {
  const { addressState, ensureAddress } = useSmartRoutingAddressContext()
  const [qrOpen, setQrOpen] = useState(false)
  const [step, setStep] = useState<SmartRoutingAddressStep>('deposit')

  useEffect(() => {
    // Errors surface via `addressState.status === 'error'`; swallow rejection
    // here so React doesn't warn about an unhandled promise.
    ensureAddress(recipient).catch(() => {})
  }, [recipient, ensureAddress])

  const title = TITLE_BY_STEP[step]

  const address =
    addressState.status === 'success' ? addressState.address : undefined

  // The QR button in AddressDisplay only exists once the address has resolved,
  // but guard here too so we don't render an empty QrSheet.
  const handleQrClick = address ? () => setQrOpen(true) : undefined

  const handleCopy = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
    } catch {
      // Clipboard can reject on insecure contexts / permissions; the visual
      // "copied" state isn't in the spec yet, so just close and swallow.
    }
    setQrOpen(false)
  }

  // Sub-view chrome — past-deposits step swaps the left slot for a back
  // chevron (TopNav default) that returns to the deposit step; deposit step
  // keeps the optional help (?) icon.
  const isPast = step === 'past'
  const leftClick = isPast
    ? () => setStep('deposit')
    : onHelp
      ? onHelp
      : undefined
  const leftIcon = isPast ? 'chevronLeft' : 'question'

  return (
    <Screen
      className={className}
      {...(size && { size })}
      topNav={
        <TopNav
          title={title}
          {...(leftClick && {
            onLeftButtonClick: leftClick,
            leftButtonIcon: leftIcon,
          })}
          onRightButtonClick={onClose}
        />
      }
    >
      {renderStep(step, {
        onQrClick: handleQrClick,
        onViewPastDeposits: () => setStep('past'),
      })}
      {/* QrSheet renders itself via `useScreenOverlayContainer()` + portal, so
        it stays inside the card frame while composing at this level rather
        than being hoisted into `Screen`'s API. Mounted whenever an address
        exists so Radix Dialog owns the open/close animation lifecycle. */}
      {address && (
        <QrSheet
          open={qrOpen}
          onOpenChange={setQrOpen}
          address={address}
          onCopy={handleCopy}
        />
      )}
    </Screen>
  )
}
