import { cn } from '../../utils/common'
import { Icon } from '../Icon'

export function AppLogo({ className }: { className?: string }) {
  return <Icon name="appLogo" className={cn('w-[66px] h-[18px]', className)} />
}
