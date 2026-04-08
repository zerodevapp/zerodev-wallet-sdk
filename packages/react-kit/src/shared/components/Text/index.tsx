import type { HTMLAttributes } from 'react'

import { cn } from '../../utils/common'

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'label'
}

export function Text({ as: Tag = 'p', className, ...props }: TextProps) {
  return (
    <Tag
      className={cn(
        'font-medium font-sans text-body2 text-greyScale',
        className,
      )}
      {...props}
    />
  )
}
