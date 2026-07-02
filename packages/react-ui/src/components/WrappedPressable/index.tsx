import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react'

import { cn } from '../../utils/common'
import { Wrapper } from '../Wrapper'

export interface WrappedPressableProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
  children: ReactNode
}

export function WrappedPressable({
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: WrappedPressableProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Wrapper
      className={cn(
        'zd:rounded-xl zd:flex zd:items-center zd:justify-center',
        className,
      )}
      variant={isHovered ? 'soft' : 'ghost'}
    >
      <button
        type="button"
        className="zd:flex zd:flex-row zd:items-center zd:justify-center zd:gap-2 zd:w-full zd:h-full zd:cursor-pointer"
        onMouseEnter={(e) => {
          setIsHovered(true)
          onMouseEnter?.(e)
        }}
        onMouseLeave={(e) => {
          setIsHovered(false)
          onMouseLeave?.(e)
        }}
        {...rest}
      >
        {children}
      </button>
    </Wrapper>
  )
}
