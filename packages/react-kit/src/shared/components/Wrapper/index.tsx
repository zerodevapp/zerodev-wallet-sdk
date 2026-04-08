import type { HTMLAttributes, PropsWithChildren } from 'react'

import { cn } from '../../utils/common'

export type WrapperVariant = 'ghost' | 'soft' | 'solid'

export interface WrapperProps extends HTMLAttributes<HTMLDivElement> {
  variant?: WrapperVariant
}

function getBackgroundAlpha(variant: WrapperVariant): number {
  switch (variant) {
    case 'ghost':
      return 0.2
    case 'soft':
      return 0.4
    case 'solid':
      return 0.8
  }
}

export function Wrapper({
  className,
  children,
  variant = 'soft',
  ...rest
}: PropsWithChildren<WrapperProps>) {
  const backgroundAlpha = getBackgroundAlpha(variant)
  const backgroundColor = `rgba(247, 245, 240, ${backgroundAlpha})`

  return (
    <div
      className={cn(
        'overflow-hidden border-white border-[0.3px] backdrop-blur-md',
        className,
      )}
      style={{ backgroundColor }}
      {...rest}
    >
      {children}
    </div>
  )
}
