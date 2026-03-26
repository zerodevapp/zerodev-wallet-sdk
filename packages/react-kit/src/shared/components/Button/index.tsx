import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'

const baseClass =
  'flex items-center justify-center rounded-3xl h-16 w-full cursor-pointer transition-colors'

const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'bg-gray-900/90 hover:bg-gray-900/93 active:bg-gray-900/95',
  secondary:
    'bg-white/50 hover:bg-white/70 active:bg-white/80 border border-gray-200',
  secondaryNeutral: 'bg-gray-700/70 hover:bg-gray-700/80 active:bg-gray-700/90',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'text-white text-base',
  secondary: 'text-gray-900 text-base',
  secondaryNeutral: 'text-white text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string
  // iconName?: IconName
  action?: 'primary' | 'secondary' | 'secondaryNeutral'
  trailIcon?: boolean
}

export function Button({
  text,
  className,
  // iconName,
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
        {/*{iconName && !trailIcon && (*/}
        {/*  <Icon name={iconName} className={cn('w-6 h-6', textClasses[action])}/>*/}
        {/*)}*/}
        {text && <span className={textClasses[action]}>{text}</span>}
        {/*{iconName && trailIcon && (*/}
        {/*  <Icon name={iconName} className={cn('w-6 h-6', textClasses[action])}/>*/}
        {/*)}*/}
      </span>
    </button>
  )
}
