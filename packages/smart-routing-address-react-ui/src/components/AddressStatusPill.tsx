import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

/**
 * The status pill under the "Ready in" row inside `ArrivesCard`.
 * Renders the appropriate copy for each address-state.
 */
export function AddressStatusPill({
  status,
  address,
  error,
  onRetry,
}: {
  status: 'loading' | 'success' | 'error'
  address?: string | undefined
  error?: Error | undefined
  onRetry?: (() => void) | undefined
}) {
  if (status === 'loading') {
    return (
      <StatusPill>
        <Icon name="lineLoading" className="zd:w-4 zd:h-4 zd:text-greyScale" />
        <Text className="zd:text-body1 zd:opacity-50 zd:whitespace-nowrap">
          Generating deposit address…
        </Text>
      </StatusPill>
    )
  }

  if (status === 'error') {
    return (
      <StatusPill>
        <Icon name="error" className="zd:w-4 zd:h-4 zd:text-negative" />
        <Text className="zd:text-body1 zd:text-negative zd:whitespace-nowrap">
          {error?.message ?? 'Failed to generate address'}
        </Text>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="zd:ml-auto zd:text-body2 zd:underline zd:cursor-pointer"
          >
            Retry
          </button>
        )}
      </StatusPill>
    )
  }

  // success — display the address (truncated) until we have the
  // dedicated "address ready + QR" Figma screen for this state.
  return (
    <StatusPill>
      <Text className="zd:text-body1 zd:whitespace-nowrap zd:truncate">
        {address ? shortenAddress(address) : ''}
      </Text>
    </StatusPill>
  )
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <Wrapper
      variant="soft"
      className={cn(
        'zd:rounded-[14px] zd:flex zd:gap-2 zd:items-center zd:justify-center zd:overflow-hidden zd:pl-4 zd:pr-2 zd:py-2 zd:w-full',
      )}
      style={{ height: 68 }}
    >
      <div className="zd:flex zd:gap-[9px] zd:h-full zd:items-center zd:justify-center zd:w-full">
        {children}
      </div>
    </Wrapper>
  )
}

function shortenAddress(addr: string) {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
