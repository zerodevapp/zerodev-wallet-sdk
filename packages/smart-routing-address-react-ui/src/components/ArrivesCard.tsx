import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

/**
 * "Arrives as" card — the destination-side of the swap. Shows the target
 * token/chain (rendered as disabled pills), an ETA row, an address status
 * pill (loading → "Generating deposit address…", success → address, error →
 * retry), and an optional minimum-deposit warning.
 */
export function ArrivesCard({
  destTokenPill,
  destChainPill,
  readyIn,
  addressStatus,
  minDeposit,
  className,
}: {
  destTokenPill: ReactNode
  destChainPill: ReactNode
  /** Estimated fill time, e.g. "≈ 3 min". */
  readyIn?: string | undefined
  /** The status pill under the ETA row (loading/address/error). */
  addressStatus: ReactNode
  /** Optional warning pill at the bottom (e.g. "Minimum deposit  27.88 USDC"). */
  minDeposit?: ReactNode
  className?: string | undefined
}) {
  return (
    <Wrapper
      variant="ghost"
      className={cn(
        'zd:rounded-2xl zd:flex zd:flex-col zd:gap-2 zd:justify-center zd:p-1 zd:w-full',
        className,
      )}
    >
      {/* Card title */}
      <div className="zd:flex zd:items-center zd:pb-1 zd:pt-3 zd:px-2 zd:rounded-3xl zd:shrink-0">
        <Text className="zd:whitespace-nowrap" style={{ fontSize: '18px' }}>
          Arrives as
        </Text>
      </div>

      {/* Dest token + chain pills */}
      <div className="zd:flex zd:gap-1 zd:items-start zd:w-full">
        <div style={{ width: 162, flexShrink: 0 }}>{destTokenPill}</div>
        <div className="zd:flex-1 zd:min-w-px">{destChainPill}</div>
      </div>

      {/* Ready in */}
      <div className="zd:flex zd:flex-col zd:px-2 zd:w-full">
        <div className="zd:flex zd:gap-1 zd:h-[25px] zd:items-center zd:w-full">
          <Text className="zd:whitespace-nowrap">Ready in</Text>
          <Icon
            name="info"
            className="zd:w-[14px] zd:h-[14px] zd:opacity-50 zd:text-greyScale"
          />
          <div className="zd:flex-1" />
          <Text className="zd:whitespace-nowrap">{readyIn ?? '—'}</Text>
        </div>
      </div>

      {/* Address status */}
      {addressStatus}

      {/* Minimum deposit warning (optional) */}
      {minDeposit}
    </Wrapper>
  )
}
