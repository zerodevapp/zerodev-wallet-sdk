import type { CSSProperties } from 'react'
import { cn } from '../../utils/common'
import { Text } from '../Text'
import { ZeroDevLogo } from '../ZeroDevLogo'

export function PoweredBy({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={cn(
        'zd:gap-1.5 zd:flex zd:flex-row zd:items-center',
        className,
      )}
    >
      <Text>Powered by</Text>
      <ZeroDevLogo
        variant="lockup"
        tone="black"
        className="zd:h-4.5 zd:w-auto"
        style={style}
      />
    </div>
  )
}
