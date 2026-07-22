import type { HTMLAttributes, PropsWithChildren, Ref } from 'react'

import { cn } from '../../utils/common'

export type WrapperVariant = 'ghost' | 'soft' | 'solid'

export interface WrapperProps extends HTMLAttributes<HTMLDivElement> {
  variant?: WrapperVariant
  ref?: Ref<HTMLDivElement> | undefined
}

function getBackgroundAlpha(variant: WrapperVariant): number {
  switch (variant) {
    case 'ghost':
      return 0.2
    case 'soft':
      return 0.5
    case 'solid':
      return 0.8
  }
}

export function Wrapper({
  className,
  children,
  variant = 'soft',
  ref,
  ...rest
}: PropsWithChildren<WrapperProps>) {
  const backgroundAlpha = getBackgroundAlpha(variant)
  const backgroundColor = `rgba(255, 255, 255, ${backgroundAlpha})`

  return (
    <div
      ref={ref}
      className={cn(
        'zd:overflow-hidden zd:border-offWhite zd:border-[0.3px] zd:backdrop-blur-[15px]',
        className,
      )}
      {...rest}
      style={{ backgroundColor, ...rest.style }}
    >
      {children}
    </div>
  )
}
