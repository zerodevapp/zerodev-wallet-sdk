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
  primary: 'zd:bg-white/40',
  secondary: 'zd:bg-orange/10',
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
        'zd:py-1 zd:px-2 zd:gap-1 zd:flex zd:flex-row zd:items-center zd:rounded-lg zd:self-start',
        variantStyles[variant],
        className,
      )}
    >
      {leadingIcon && (
        <Icon
          name={leadingIcon}
          className="zd:w-3 zd:h-3 zd:text-solarOrange"
        />
      )}
      <Text className="zd:text-body3">{text}</Text>
      {trailingIcon && (
        <Icon name={trailingIcon} className="zd:w-2.5 zd:h-2.5" />
      )}
    </div>
  )
}
