import type { ButtonHTMLAttributes, CSSProperties } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

// The frosted surface (white@0.5 bg, 0.3px border, 15px blur) comes from Wrapper.
// Button layers on top of it the Figma button spec: a transparent border
// (overriding Wrapper's offWhite stroke) and the "blur effect" inset shadows.
// Radius and height are per-size; per-variant colour + hover/active live on
// the inner <button>.
const surfaceClass =
  'zd:border-white/0 ' +
  'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.10),inset_0_3px_4px_0_rgba(0,0,0,0.02)]'

const innerClass =
  'zd:flex zd:items-center zd:justify-center zd:gap-2 zd:w-full zd:px-5 zd:cursor-pointer zd:transition-colors'

// lg = the original 64px/24px-radius spec; sm = the design system's small
// button (Figma "s-button": 48px tall, 14px radius, 16px icons).
const sizeSurfaceClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  lg: 'zd:rounded-3xl',
  sm: 'zd:rounded-[14px]',
}
const sizeInnerClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  lg: 'zd:h-16 zd:py-3.5',
  sm: 'zd:h-12',
}
const sizeIconClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  lg: 'zd:w-6 zd:h-6',
  sm: 'zd:w-4 zd:h-4',
}

// secondary keeps Wrapper's white@0.5 surface; primary overrides it with a dark
// translucent fill (via inline style, since Wrapper sets its bg inline). Hover/
// active tints sit on the inner button.
const bgClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:hover:bg-white/5 zd:active:bg-white/10',
  secondary: 'zd:hover:bg-white/20 zd:active:bg-white/30',
}

const primaryStyle: CSSProperties = {
  backgroundColor: 'rgba(19, 14, 11, 0.9)',
}

const textClasses: Record<NonNullable<ButtonProps['action']>, string> = {
  primary: 'zd:text-white zd:text-body1',
  secondary: 'zd:text-greyScale zd:text-body1',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string
  iconName?: IconName
  action?: 'primary' | 'secondary'
  /** `lg` (default) is the 64px hero button; `sm` the 48px row button. */
  size?: 'lg' | 'sm'
  trailIcon?: boolean
}

export function Button({
  text,
  className,
  iconName,
  trailIcon,
  disabled,
  action = 'primary',
  size = 'lg',
  children,
  ...rest
}: ButtonProps) {
  return (
    <Wrapper
      className={cn(
        surfaceClass,
        sizeSurfaceClasses[size],
        { 'zd:opacity-50': disabled },
        className,
      )}
      {...(action === 'primary' && { style: primaryStyle })}
    >
      <button
        type={rest.type ?? 'button'}
        className={cn(innerClass, sizeInnerClasses[size], bgClasses[action], {
          'zd:cursor-not-allowed': disabled,
        })}
        disabled={disabled}
        {...rest}
      >
        {iconName && !trailIcon && (
          <Icon
            name={iconName}
            className={cn(sizeIconClasses[size], textClasses[action])}
          />
        )}
        {text && <Text className={textClasses[action]}>{text}</Text>}
        {/* Custom content slot — callers own its layout (e.g. a w-full
            justify-between row). Rendered after `text` so both can combine. */}
        {children}
        {iconName && trailIcon && (
          <Icon
            name={iconName}
            className={cn(sizeIconClasses[size], textClasses[action])}
          />
        )}
      </button>
    </Wrapper>
  )
}
