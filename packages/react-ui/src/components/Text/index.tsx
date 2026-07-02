import type { AnchorHTMLAttributes, HTMLAttributes } from 'react'

import { cn } from '../../utils/common'

export type TextProps =
  | ({ as?: 'p' | 'span' | 'label' } & HTMLAttributes<HTMLElement>)
  | ({ as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>)

export function Text({ as: Tag = 'p', className, ...props }: TextProps) {
  return (
    <Tag
      className={cn(
        'zd:font-medium zd:font-sans zd:text-body2 zd:text-greyScale',
        className,
      )}
      {...(props as HTMLAttributes<HTMLElement> &
        AnchorHTMLAttributes<HTMLAnchorElement>)}
    />
  )
}
