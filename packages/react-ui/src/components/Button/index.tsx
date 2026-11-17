import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

// The frosted surface (bright-secondary bg, 0.3px border, 15px blur) comes
// from Wrapper. Button layers on top of it the Figma button spec: 24px radius,
// a transparent border (overriding Wrapper's neutral stroke), and the "blur
// effect" inset shadows. Per-variant colour + hover/active live on the inner
// <button>.
const surfaceClass =
  'zd:rounded-3xl zd:border-transparent ' +
  'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.10),inset_0_3px_4px_0_rgba(0,0,0,0.02)]'

const innerClass =
  'zd:flex zd:items-center zd:justify-center zd:gap-2 zd:h-16 zd:w-full zd:px-5 zd:py-3.5 zd:cursor-pointer zd:transition-colors'

// secondary keeps Wrapper's bright-secondary surface; primary replaces it with
// the inverse (dark, translucent) fill. Hover/active tints sit on the inner
// button: white overlays that read the same on every theme.
const surfaceClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:bg-inverse-secondary',
  secondary: '',
}

const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:hover:bg-white/5 zd:active:bg-white/10',
  secondary: 'zd:hover:bg-white/20 zd:active:bg-white/30',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:text-inverse-primary zd:text-body1',
  secondary: 'zd:text-neutral-primary zd:text-body1',
}

const iconClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:text-icon-inverse-primary',
  secondary: 'zd:text-icon-neutral-primary',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string
  iconName?: IconName
  action?: 'primary' | 'secondary'
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
    <Wrapper
      className={cn(
        surfaceClass,
        surfaceClasses[action],
        { 'zd:opacity-50': disabled },
        className,
      )}
    >
      <button
        type={rest.type ?? 'button'}
        className={cn(innerClass, bgClasses[action], {
          'zd:cursor-not-allowed': disabled,
        })}
        disabled={disabled}
        {...rest}
      >
        {iconName && !trailIcon && (
          <Icon
            name={iconName}
            className={cn('zd:w-6 zd:h-6', iconClasses[action])}
          />
        )}
        {text && <Text className={textClasses[action]}>{text}</Text>}
        {iconName && trailIcon && (
          <Icon
            name={iconName}
            className={cn('zd:w-6 zd:h-6', iconClasses[action])}
          />
        )}
      </button>
    </Wrapper>
  )
}
