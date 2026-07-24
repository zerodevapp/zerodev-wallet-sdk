import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

/** `'contained'` wraps the image in a white 44px tile; `'filled'` renders the
 *  image directly at 44px (no wrapper). */
export type InfoCardImageStyle = 'contained' | 'filled'

export interface InfoCardProps {
  title: string
  subtitle?: string
  imageSource?: string
  /** Optional small chain-badge overlay on the token icon (bottom-right).
   * Follows the same pattern as `TxnItem`'s pair-mark. */
  chainIconUrl?: string
  rightElement?: ReactNode
  imageStyle?: InfoCardImageStyle
  className?: string
}

export function InfoCard({
  title,
  subtitle,
  imageSource,
  chainIconUrl,
  imageStyle = 'contained',
  rightElement,
  className,
}: InfoCardProps) {
  return (
    <Wrapper
      className={cn(
        'zd:h-[84px] zd:px-3 zd:rounded-2xl zd:flex zd:flex-row zd:items-center zd:gap-2 zd:w-full zd:justify-between',
        className,
      )}
    >
      <div className="zd:gap-2 zd:flex zd:flex-row zd:items-center zd:h-[52px]">
        {imageSource || chainIconUrl ? (
          <IconWithBadge
            imageStyle={imageStyle}
            {...(imageSource && { imageSource })}
            {...(chainIconUrl && { chainIconUrl })}
          />
        ) : null}
        <div className="zd:flex zd:flex-col">
          <Text className="zd:text-body1">{title}</Text>
          {subtitle && <Text className="zd:text-greyScale/50">{subtitle}</Text>}
        </div>
      </div>
      {rightElement}
    </Wrapper>
  )
}

function IconWithBadge({
  imageSource,
  chainIconUrl,
  imageStyle,
}: {
  imageSource?: string
  chainIconUrl?: string
  imageStyle: InfoCardImageStyle
}) {
  return (
    <div className="zd:relative zd:size-11 zd:shrink-0">
      {imageStyle === 'contained' ? (
        <div className="zd:size-full zd:rounded-xl zd:bg-white zd:flex zd:items-center zd:justify-center">
          {imageSource && (
            <img src={imageSource} alt="" className="zd:w-8 zd:h-8" />
          )}
        </div>
      ) : (
        imageSource && (
          <img
            src={imageSource}
            alt=""
            className="zd:size-full zd:rounded-xl"
          />
        )
      )}
      {chainIconUrl && (
        <div className="zd:absolute zd:right-0 zd:bottom-0 zd:size-3.5 zd:overflow-hidden zd:rounded-full zd:border zd:border-white zd:bg-greyScale/10">
          <img
            src={chainIconUrl}
            alt=""
            className="zd:size-full zd:object-contain"
          />
        </div>
      )}
    </div>
  )
}
