import type { HTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface AddressDisplayProps extends HTMLAttributes<HTMLDivElement> {
  /** The address (or other long identifier) to display. Wraps to the next line if it overflows. */
  address: string
  /** Handler for the trailing QR icon button. */
  onQrClick: () => void
  className?: string
}

export function AddressDisplay({
  address,
  onQrClick,
  className,
  ...rest
}: AddressDisplayProps) {
  return (
    <Wrapper
      className={cn(
        'rounded-[14px] border-offWhite flex flex-row items-center gap-3 pl-4 pr-2 py-2 w-full',
        className,
      )}
      {...rest}
    >
      <Text className="text-body1 flex-1 min-w-0 break-all">{address}</Text>
      <button
        type="button"
        onClick={onQrClick}
        aria-label="Show QR code"
        className="bg-white size-13 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer hover:bg-white/80 transition-colors"
      >
        <Icon name="qrCode" className="size-5 text-greyScale" />
      </button>
    </Wrapper>
  )
}
