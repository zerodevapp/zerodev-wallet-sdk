import type { CSSProperties } from 'react'
import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Text } from '../Text'

export function AppLogo({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={cn('gap-1.5 flex flex-row items-center', className)}>
      <Text>Powered by:</Text>
      <Icon name="appLogo" className="w-[66px] h-[18px]" style={style} />
    </div>
  )
}
