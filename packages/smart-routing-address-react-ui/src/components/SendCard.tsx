import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

/**
 * "Send" card — the source-side of the swap. Contains two selector pills
 * (token + chain) laid out horizontally, plus a metadata section (max
 * slippage, estimated fee).
 */
export function SendCard({
  tokenPill,
  chainPill,
  slippage,
  estimatedFee,
  className,
}: {
  tokenPill: ReactNode
  chainPill: ReactNode
  slippage?: string
  estimatedFee?: string
  className?: string
}) {
  return (
    <Wrapper
      variant="ghost"
      className={cn(
        'zd:rounded-2xl zd:flex zd:flex-col zd:justify-center zd:p-1 zd:w-full',
        className,
      )}
    >
      {/* Card title */}
      <div className="zd:flex zd:items-center zd:px-2 zd:py-3 zd:rounded-3xl zd:shrink-0">
        <Text className="zd:whitespace-nowrap" style={{ fontSize: '18px' }}>
          Send
        </Text>
      </div>

      {/* Token + chain pills */}
      <div className="zd:flex zd:gap-1 zd:items-start zd:w-full">
        <div style={{ width: 162, flexShrink: 0 }}>{tokenPill}</div>
        <div className="zd:flex-1 zd:min-w-px">{chainPill}</div>
      </div>

      {/* Metadata rows */}
      <div className="zd:flex zd:flex-col zd:gap-2 zd:items-start zd:px-2 zd:py-4 zd:w-full">
        <MetaRow label="Max slippage" value={slippage ?? '—'} />
        <MetaRow
          label="Estimated fee"
          value={estimatedFee ?? '—'}
          valueTrailing={
            <Icon
              name="chevronDown"
              className="zd:w-3 zd:h-3 zd:text-greyScale"
            />
          }
        />
      </div>
    </Wrapper>
  )
}

function MetaRow({
  label,
  value,
  valueTrailing,
}: {
  label: string
  value: string
  valueTrailing?: ReactNode
}) {
  return (
    <div className="zd:flex zd:gap-1 zd:items-center zd:py-1 zd:w-full">
      <Text className="zd:whitespace-nowrap">{label}</Text>
      <Icon
        name="info"
        className="zd:w-[14px] zd:h-[14px] zd:opacity-50 zd:text-greyScale"
      />
      <div className="zd:flex-1" />
      <div className="zd:flex zd:items-center zd:gap-px">
        <Text className="zd:whitespace-nowrap">{value}</Text>
        {valueTrailing}
      </div>
    </div>
  )
}
