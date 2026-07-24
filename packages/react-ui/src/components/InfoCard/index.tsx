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
  // Single layout: an outer 44px tile whose interior renders per `imageStyle`
  // — `contained` uses the PairMark tile (translucent white/60 backdrop-blur
  // with a circular token disc centered inside, matching `TxnItem`), and
  // `filled` renders the image bare at 44px. The chain badge is an optional
  // overlay in both variants — no chainIconUrl-driven branch.
  return (
    <div className="zd:relative zd:size-11 zd:shrink-0">
      {imageStyle === 'contained' ? (
        <div
          className={cn(
            'zd:size-full zd:rounded-xl zd:isolate zd:bg-white/60 zd:backdrop-blur-[30px]',
            'zd:shadow-[inset_0_3px_4px_0_rgba(0,0,0,0.02),inset_0_-4px_4px_0_rgba(255,255,255,0.1)]',
          )}
        >
          {imageSource && (
            <div className="zd:absolute zd:top-1/2 zd:left-1/2 zd:size-8.5 zd:-translate-x-1/2 zd:-translate-y-1/2 zd:overflow-hidden zd:rounded-full zd:bg-greyScale/10">
              <img
                src={imageSource}
                alt=""
                className="zd:size-full zd:object-contain"
              />
            </div>
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
        // Small chain disc inset from the bottom-right corner. Explicit
        // `h-3 w-3` rather than the `size-3` shortcut — sub-unit variants
        // (`size-3.5` etc.) don't compile under the `zd:` prefix, so pairs
        // are used across `TxnItem` too for consistency. `p-0.5` leaves the
        // chain icon breathing room inside the white disc (Figma
        // `18210:73702`) rather than filling edge-to-edge.
        <div className="zd:absolute zd:right-1 zd:bottom-1 zd:h-3 zd:w-3 zd:overflow-hidden zd:rounded-full zd:bg-white zd:p-px">
          <img
            src={chainIconUrl}
            alt=""
            className="zd:h-full zd:w-full zd:object-contain"
          />
        </div>
      )}
    </div>
  )
}
