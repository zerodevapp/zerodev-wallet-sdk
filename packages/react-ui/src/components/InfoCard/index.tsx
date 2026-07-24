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
  // When a chain badge is present, always render the PairMark tile pattern
  // (matches `TxnItem`): translucent white/60 backdrop-blurred rounded tile
  // with a circular token image centered inside and a small chain disc inset
  // from the corner. `imageStyle` only branches when the badge is absent
  // (preserved for wallet-react-ui's avatar-style consumers).
  if (chainIconUrl) {
    return (
      <div
        className={cn(
          'zd:relative zd:size-11 zd:shrink-0 zd:rounded-xl zd:isolate zd:bg-white/60 zd:backdrop-blur-[30px]',
          'zd:shadow-[inset_0_3px_4px_0_rgba(0,0,0,0.02),inset_0_-4px_4px_0_rgba(255,255,255,0.1)]',
        )}
      >
        <div className="zd:absolute zd:top-1/2 zd:left-1/2 zd:size-8.5 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:overflow-hidden zd:rounded-full zd:bg-greyScale/10">
          {imageSource && (
            <img
              src={imageSource}
              alt=""
              className="zd:size-full zd:object-contain"
            />
          )}
        </div>
        {/* Chain disc inset from the corner. Explicit `h-3 w-3` — Tailwind's
         *  `size-3` shortcut compiles fine but sub-unit `size-3.5` doesn't
         *  under the `zd:` prefix, so `h-*`/`w-*` is used across TxnItem too
         *  for consistency. */}
        <div className="zd:absolute zd:right-1 zd:bottom-1 zd:h-3 zd:w-3 zd:overflow-hidden zd:rounded-full zd:border zd:border-white zd:bg-greyScale/10">
          <img
            src={chainIconUrl}
            alt=""
            className="zd:h-full zd:w-full zd:object-contain"
          />
        </div>
      </div>
    )
  }

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
    </div>
  )
}
