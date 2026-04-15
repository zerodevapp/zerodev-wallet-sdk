import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'

const baseClass =
  'flex items-center justify-center rounded-3xl h-16 w-full cursor-pointer transition-colors'

const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'bg-greyScale/90 hover:bg-greyScale/93 active:bg-greyScale/95',
  secondary: 'bg-white/50 hover:bg-white/70 active:bg-white/80',
  secondaryNeutral:
    'bg-greyScale/70 hover:bg-greyScale/80 active:bg-greyScale/90',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'text-white text-body1',
  secondary: 'text-gray-900 text-body1',
  secondaryNeutral: 'text-white text-body1',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string
  iconName?: IconName
  action?: 'primary' | 'secondary' | 'secondaryNeutral'
  trailIcon?: boolean
}

export function Button({
  text,
  className,
  iconName,
  trailIcon,
  disabled,
  action = 'primary',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={rest.type ?? 'button'}
      className={cn(
        baseClass,
        bgClasses[action],
        {
          'opacity-50 cursor-not-allowed': disabled,
        },
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      <span className="flex flex-row items-center gap-2 justify-center">
        {iconName && !trailIcon && (
          <Icon
            name={iconName}
            className={cn('w-6 h-6', textClasses[action])}
          />
        )}
        {text && <Text className={textClasses[action]}>{text}</Text>}
        {iconName && trailIcon && (
          <Icon
            name={iconName}
            className={cn('w-6 h-6', textClasses[action])}
          />
        )}
      </span>
    </button>
  )
}
