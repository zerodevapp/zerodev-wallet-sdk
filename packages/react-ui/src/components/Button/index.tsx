import type { ButtonHTMLAttributes, CSSProperties } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

// The frosted surface (white@0.5 bg, 0.3px border, 15px blur) comes from Wrapper.
// Button layers on top of it the Figma button spec: 24px radius, a transparent
// border (overriding Wrapper's offWhite stroke), and the "blur effect" inset
// shadows. Per-variant colour + hover/active live on the inner <button>.
const surfaceClass =
  'rounded-3xl border-white/0 ' +
  'shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.10),inset_0_3px_4px_0_rgba(0,0,0,0.02)]'

const innerClass =
  'flex items-center justify-center gap-2 h-16 w-full px-5 py-3.5 cursor-pointer transition-colors'

// secondary keeps Wrapper's white@0.5 surface; primary overrides it with a dark
// translucent fill (via inline style, since Wrapper sets its bg inline). Hover/
// active tints sit on the inner button.
const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'hover:bg-white/5 active:bg-white/10',
  secondary: 'hover:bg-white/20 active:bg-white/30',
}

const primaryStyle: CSSProperties = {
  backgroundColor: 'rgba(19, 14, 11, 0.9)',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'text-white text-body1',
  secondary: 'text-greyScale text-body1',
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
      className={cn(surfaceClass, { 'opacity-50': disabled }, className)}
      {...(action === 'primary' && { style: primaryStyle })}
    >
      <button
        type={rest.type ?? 'button'}
        className={cn(innerClass, bgClasses[action], {
          'cursor-not-allowed': disabled,
        })}
        disabled={disabled}
        {...rest}
      >
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
      </button>
    </Wrapper>
  )
}
