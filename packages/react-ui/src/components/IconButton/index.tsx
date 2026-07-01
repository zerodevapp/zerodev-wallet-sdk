import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../utils/common'
import { Icon, type IconName } from '../Icon'
import { Wrapper } from '../Wrapper'

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconName: IconName
}

export function IconButton({ iconName, className, ...rest }: IconButtonProps) {
  return (
    <Wrapper className={cn('h-13 w-13 rounded-2xl', className)}>
      <button
        type="button"
        className="flex items-center justify-center flex-1 h-full w-full cursor-pointer hover:bg-white/20 active:bg-white/30 transition-colors"
        {...rest}
      >
        <Icon name={iconName} className="h-6 w-6 text-greyScale" />
      </button>
    </Wrapper>
  )
}
