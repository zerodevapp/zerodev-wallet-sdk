import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'
import type { HTMLAttributes } from 'react'

export interface LoadingCardProps extends HTMLAttributes<HTMLDivElement> {
  text: string
}

export function LoadingCard({ text, className, ...rest }: LoadingCardProps) {
  return (
    <Wrapper
      variant="ghost"
      className={cn(
        'zd:relative zd:flex zd:h-[68px] zd:w-full zd:items-center zd:justify-start zd:gap-2 zd:overflow-hidden zd:rounded-2xl zd:px-4',
        'zd:shadow-[inset_0_-4px_4px_0_rgba(255,255,255,0.1),inset_0_3px_4px_0_rgba(0,0,0,0.02)]',
        className,
      )}
      {...rest}
    >
      <Icon
        name="lineLoading"
        className="zd:size-4 zd:text-greyScale/50"
        data-testid="loading-card-icon"
      />
      <Text className="zd:text-body1 zd:text-greyScale/50">{text}</Text>
    </Wrapper>
  )
}
