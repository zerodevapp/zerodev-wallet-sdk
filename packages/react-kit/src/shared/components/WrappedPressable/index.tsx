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
      className={cn('rounded-xl flex items-center justify-center', className)}
      variant={isHovered ? 'soft' : 'ghost'}
    >
      <button
        type="button"
        className="flex flex-row items-center justify-center gap-2 w-full h-full cursor-pointer"
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
