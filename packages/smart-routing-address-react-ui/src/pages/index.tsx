import { Screen, TopNav } from '@zerodev/react-ui'
import type { DepositedToken } from '@zerodev/smart-routing-address'
import { type ReactNode, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { QrSheet } from '../components/QrSheet'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { Deposit } from './Deposit'
import { PastDeposits } from './PastDeposits'
import { TransactionDetails } from './TransactionDetails'

/**
 * Steps rendered by `SmartRoutingAddress`. Sub-views advance/rewind local
 * step state; the widget owns navigation and the `TopNav` chrome accordingly.
 */
export type SmartRoutingAddressStep = 'deposit' | 'past' | 'transaction'

const TITLE_BY_STEP: Record<SmartRoutingAddressStep, string> = {
  deposit: 'Deposit funds',
  past: 'Past deposits',
  transaction: 'Transaction details',
}

function renderStep(
  step: SmartRoutingAddressStep,
  {
    onQrClick,
    onViewPastDeposits,
    onSelectDeposit,
    selectedDeposit,
  }: {
    onQrClick?: (() => void) | undefined
    onViewPastDeposits?: (() => void) | undefined
    onSelectDeposit?: ((deposit: DepositedToken) => void) | undefined
    selectedDeposit?: DepositedToken | undefined
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
      return <PastDeposits {...(onSelectDeposit && { onSelectDeposit })} />
    case 'transaction':
      // `selectedDeposit` is set by the past-deposits row-click handler
      // before advancing the step, so this branch always has a deposit.
      return selectedDeposit ? (
        <TransactionDetails deposit={selectedDeposit} />
      ) : null
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
  const [selectedDeposit, setSelectedDeposit] = useState<
    DepositedToken | undefined
  >(undefined)

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

  // Sub-view chrome — sub-views swap the left slot for a back chevron that
  // returns to the parent step. Root (deposit) step keeps the optional
  // help (?) icon.
  const goBack =
    step === 'transaction'
      ? () => setStep('past')
      : step === 'past'
        ? () => setStep('deposit')
        : undefined
  const leftClick = goBack ?? onHelp ?? undefined
  const leftIcon: 'chevronLeft' | 'question' = goBack
    ? 'chevronLeft'
    : 'question'

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
        onSelectDeposit: (deposit) => {
          setSelectedDeposit(deposit)
          setStep('transaction')
        },
        selectedDeposit,
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
