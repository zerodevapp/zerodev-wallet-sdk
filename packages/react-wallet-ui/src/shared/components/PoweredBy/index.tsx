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
    <div className={cn('gap-1.5 flex flex-row items-center', className)}>
      <Text>Powered by</Text>
      <Icon name="zerodevLogo" className="h-[18px] w-auto" style={style} />
    </div>
  )
}
