import type { ReactNode } from 'react'

import { Text } from '../../../shared/components/Text'
import { Wrapper } from '../../../shared/components/Wrapper'

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
    <Wrapper className="h-[84px] px-3 rounded-2xl flex flex-row items-center gap-2 w-full justify-between">
      <div className="gap-2 flex flex-row items-center h-[52px]">
        {imageStyle === 'contained' ? (
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
            {imageSource && (
              <img src={imageSource} alt="" className="w-8 h-8" />
            )}
          </div>
        ) : (
          imageSource && (
            <img
              src={imageSource}
              alt=""
              className="w-11 h-11 rounded-xl shrink-0"
            />
          )
        )}
        <div className="flex flex-col">
          <Text className="text-body1">{title}</Text>
          {subtitle && <Text className="text-greyScale/50">{subtitle}</Text>}
        </div>
      </div>
      {rightElement}
    </Wrapper>
  )
}
