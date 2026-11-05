import type { HTMLAttributes, PropsWithChildren, Ref } from 'react'

import { cn } from '../../utils/common'

export type WrapperVariant = 'ghost' | 'soft' | 'solid'

export interface WrapperProps extends HTMLAttributes<HTMLDivElement> {
  variant?: WrapperVariant
  ref?: Ref<HTMLDivElement> | undefined
}

/** The frosted surface per variant: the design system's bright-neutral
 * backgrounds, from a 20% white tint (ghost) to solid white (solid). */
const backgroundClasses: Record<WrapperVariant, string> = {
  ghost: 'zd:bg-bright-tertiary',
  soft: 'zd:bg-bright-secondary',
  solid: 'zd:bg-bright-primary',
}

export function Wrapper({
  className,
  children,
  variant = 'soft',
  ref,
  ...rest
}: PropsWithChildren<WrapperProps>) {
  return (
    <div
      ref={ref}
      className={cn(
        // `zd-surface` marks the frosted surface for theme/brand.css.
        'zd-surface zd:overflow-hidden zd:border-neutral-primary zd:border-[0.3px] zd:backdrop-blur-[15px]',
        backgroundClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
