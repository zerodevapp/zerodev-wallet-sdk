import { cn } from '@zerodev/react-ui'
import type { CSSProperties, ReactNode } from 'react'
import { TOP_NAV_HEIGHT } from '../TopNav'
import {
  CardGlow,
  MultiRadialBackground,
  WrapperBorder,
} from './MultiRadialBackground'

const CONTENT_PADDING_TOP = TOP_NAV_HEIGHT + 16

export function Screen({
  children,
  className,
  contentClassName,
  style,
  topNav,
}: {
  children: ReactNode
  className?: string | undefined
  contentClassName?: string | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col relative overflow-hidden w-100 max-w-full h-[min(800px,100dvh)] rounded-[36px] text-left',
        className,
      )}
      style={style}
    >
      {/* Gradient border layer — fills the frame; the card on top has a 6px
          margin so this shows as the border ring. */}
      <WrapperBorder />
      {/* Inner card sits on top with a 6px margin, exposing the border ring.
          Its own gradient (base + CardGlow) fills the card so the colour stays
          vivid and distinct from the border. */}
      <div
        className={cn(
          'flex flex-1 flex-col m-1.5 px-4 overflow-hidden rounded-4xl relative',
          contentClassName,
        )}
        // clip-path clips backdrop-filter to the rounded corners; plain
        // overflow-hidden does not (WebKit/Chromium leaves scrolled blurred
        // children bleeding past the radius). Must match rounded-4xl (32px).
        style={{ clipPath: 'inset(0 round 32px)' }}
      >
        <MultiRadialBackground />
        <CardGlow />
        <div className="relative z-10 flex flex-1 flex-col min-h-0">
          {topNav}
          <div
            className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden"
            style={{ paddingTop: `${CONTENT_PADDING_TOP}px` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
