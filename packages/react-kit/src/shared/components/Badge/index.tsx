import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'

export interface BadgeProps {
  text: string
  variant?: 'primary' | 'secondary'
  leadingIcon?: IconName
  trailingIcon?: IconName
  className?: string
}

const variantStyles = {
  primary: 'bg-white/40',
  secondary: 'bg-orange/10',
}

export function Badge({
  text,
  variant = 'primary',
  leadingIcon,
  trailingIcon,
  className,
}: BadgeProps) {
  return (
    <div
      className={cn(
        'py-1 px-2 gap-1 flex flex-row items-center rounded-lg self-start',
        variantStyles[variant],
        className,
      )}
    >
      {leadingIcon && (
        <Icon name={leadingIcon} className="w-3 h-3 text-solarOrange" />
      )}
      <Text className="text-body3">{text}</Text>
      {trailingIcon && <Icon name={trailingIcon} className="w-2.5 h-2.5" />}
    </div>
  )
}
