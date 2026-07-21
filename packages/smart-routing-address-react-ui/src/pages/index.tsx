import { QrSheet, Screen, TopNav } from '@zerodev/react-ui'
import { type ReactNode, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSmartRoutingAddressContext } from '../context/SmartRoutingAddressContext'
import { Deposit } from './Deposit'

/**
 * Steps rendered by `SmartRoutingAddress`. Only "deposit" is implemented for
 * this pass; QR / active-deposits / history / error screens will land as
 * additional cases once their Figma is wired.
 */
export type SmartRoutingAddressStep = 'deposit'

const TITLE_BY_STEP: Record<SmartRoutingAddressStep, string> = {
  deposit: 'Deposit funds',
}

function renderStep(
  step: SmartRoutingAddressStep,
  { onQrClick }: { onQrClick?: (() => void) | undefined },
): ReactNode {
  switch (step) {
    case 'deposit':
      return <Deposit {...(onQrClick && { onQrClick })} />
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
  /** Called when the top-left ? help button is clicked. Optional. */
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

  useEffect(() => {
    // Errors surface via `addressState.status === 'error'`; swallow rejection
    // here so React doesn't warn about an unhandled promise.
    ensureAddress(recipient).catch(() => {})
  }, [recipient, ensureAddress])

  // Only one step is implemented for now; add state (e.g. from context or a
  // local machine) here when the flow grows to multiple screens.
  const step: SmartRoutingAddressStep = 'deposit'
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

  return (
    <Screen
      className={className}
      {...(size && { size })}
      topNav={
        <TopNav
          title={title}
          {...(onHelp && {
            onLeftButtonClick: onHelp,
            leftButtonIcon: 'question',
          })}
          onRightButtonClick={onClose}
        />
      }
    >
      {renderStep(step, { onQrClick: handleQrClick })}
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
