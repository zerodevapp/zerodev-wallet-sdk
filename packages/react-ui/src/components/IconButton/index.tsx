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
    <Wrapper className={cn('zd:h-13 zd:w-13 zd:rounded-2xl', className)}>
      <button
        type="button"
        className="zd:flex zd:items-center zd:justify-center zd:flex-1 zd:h-full zd:w-full zd:cursor-pointer zd:hover:bg-white/20 zd:active:bg-white/30 zd:transition-colors"
        {...rest}
      >
        <Icon name={iconName} className="zd:h-6 zd:w-6 zd:text-greyScale" />
      </button>
    </Wrapper>
  )
}
