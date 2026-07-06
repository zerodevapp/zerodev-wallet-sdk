import type { CSSProperties } from 'react'
import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Text } from '../Text'

export function PoweredBy({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      data-testid="powered-by"
      className={cn(
        'zd:gap-1.5 zd:flex zd:flex-row zd:items-center',
        className,
      )}
    >
      <Text>Powered by</Text>
      <Icon
        name="zerodevLogo"
        className="zd:h-[18px] zd:w-auto"
        style={style}
      />
    </div>
  )
}
