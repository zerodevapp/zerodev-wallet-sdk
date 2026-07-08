import { Screen, TopNav } from '@zerodev/react-ui'
import { type ReactNode, useEffect } from 'react'
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
  /** Called when the QR icon inside `AddressDisplay` is clicked. Optional. */
  onQrClick?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg' | undefined
}

export function SmartRoutingAddress({
  recipient,
  onClose,
  onHelp,
  onQrClick,
  className,
  size,
}: SmartRoutingAddressProps) {
  const { ensureAddress } = useSmartRoutingAddressContext()

  useEffect(() => {
    // Errors surface via `addressState.status === 'error'`; swallow rejection
    // here so React doesn't warn about an unhandled promise.
    ensureAddress(recipient).catch(() => {})
  }, [recipient, ensureAddress])

  // Only one step is implemented for now; add state (e.g. from context or a
  // local machine) here when the flow grows to multiple screens.
  const step: SmartRoutingAddressStep = 'deposit'
  const title = TITLE_BY_STEP[step]

  return (
    <Screen
      className={className}
      {...(size && { size })}
      topNav={
        <TopNav title={title} {...(onHelp && { onHelp })} onClose={onClose} />
      }
    >
      {renderStep(step, { onQrClick })}
    </Screen>
  )
}
