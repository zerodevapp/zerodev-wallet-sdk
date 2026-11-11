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
        'zd:overflow-hidden zd:border-neutral-primary zd:border-[0.3px] zd:backdrop-blur-[15px]',
        // Plain brand: the frosted hairline reads as a 1px line in the
        // neutral border colour. An inset outline, not a wider border:
        // browsers lay the 0.3px stroke out as half a device pixel, so a
        // 1px border would make every content-sized surface a pixel taller
        // than its branded twin and shift the layout on a theme switch.
        // Keyboard focus keeps the platform ring the outline would replace.
        // The shorthand, not `outline-1` + colour: callers pass
        // `zd:outline-none`, which tailwind-merge would let win over the
        // split utilities, and whose `--tw-outline-style` they would read.
        'zd:plain:[outline:1px_solid_var(--zd-border-neutral-primary)] zd:plain:-outline-offset-1',
        'zd:plain:focus-visible:[outline:auto] zd:plain:focus-visible:outline-offset-0',
        backgroundClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
