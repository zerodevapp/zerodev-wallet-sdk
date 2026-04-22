import type { AnchorHTMLAttributes, HTMLAttributes } from 'react'

import { cn } from '../../utils/common'

export type TextProps =
  | ({ as?: 'p' | 'span' | 'label' } & HTMLAttributes<HTMLElement>)
  | ({ as: 'a' } & AnchorHTMLAttributes<HTMLAnchorElement>)

export function Text({ as: Tag = 'p', className, ...props }: TextProps) {
  return (
    <Tag
      className={cn(
        'font-medium font-sans text-body2 text-greyScale',
        className,
      )}
      {...(props as HTMLAttributes<HTMLElement> &
        AnchorHTMLAttributes<HTMLAnchorElement>)}
    />
  )
}
