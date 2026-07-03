import { cn, Icon, Text } from '@zerodev/react-ui'
import type { CSSProperties } from 'react'

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
      <Icon name="zerodevLogo" className="zd:h-4.5 zd:w-auto" style={style} />
    </div>
  )
}
