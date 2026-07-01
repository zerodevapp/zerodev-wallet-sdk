import { Text, Wrapper } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

type ImageStyle = 'contained' | 'filled'

export interface InfoCardProps {
  title: string
  subtitle?: string
  imageSource?: string
  rightElement?: ReactNode
  imageStyle?: ImageStyle
}

export function InfoCard({
  title,
  subtitle,
  imageSource,
  imageStyle = 'contained',
  rightElement,
}: InfoCardProps) {
  return (
    <Wrapper className="zd:h-[84px] zd:px-3 zd:rounded-2xl zd:flex zd:flex-row zd:items-center zd:gap-2 zd:w-full zd:justify-between">
      <div className="zd:gap-2 zd:flex zd:flex-row zd:items-center zd:h-[52px]">
        {imageStyle === 'contained' ? (
          <div className="zd:w-11 zd:h-11 zd:rounded-xl zd:bg-white zd:flex zd:items-center zd:justify-center zd:shrink-0">
            {imageSource && (
              <img src={imageSource} alt="" className="zd:w-8 zd:h-8" />
            )}
          </div>
        ) : (
          imageSource && (
            <img
              src={imageSource}
              alt=""
              className="zd:w-11 zd:h-11 zd:rounded-xl zd:shrink-0"
            />
          )
        )}
        <div className="zd:flex zd:flex-col">
          <Text className="zd:text-body1">{title}</Text>
          {subtitle && <Text className="zd:text-greyScale/50">{subtitle}</Text>}
        </div>
      </div>
      {rightElement}
    </Wrapper>
  )
}
