import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../utils/common'
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
        'zd:flex zd:flex-col zd:overflow-hidden zd:text-left',
        'zd:fixed zd:inset-0 zd:z-50 zd:w-screen zd:h-[100dvh] zd:rounded-[36px]',
        'zd:sm:relative zd:sm:z-auto zd:sm:w-100 zd:sm:max-w-full zd:sm:h-[810px] zd:sm:max-h-[100dvh]',
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
          'zd:flex zd:flex-1 zd:flex-col zd:m-1.5 zd:px-4 zd:overflow-hidden zd:rounded-4xl zd:relative',
          contentClassName,
        )}
        // clip-path clips backdrop-filter to the rounded corners; plain
        // overflow-hidden does not (WebKit/Chromium leaves scrolled blurred
        // children bleeding past the radius). Must match rounded-4xl (32px).
        style={{ clipPath: 'inset(0 round 32px)' }}
      >
        <MultiRadialBackground />
        <CardGlow />
        <div className="zd:relative zd:z-10 zd:flex zd:flex-1 zd:flex-col zd:min-h-0">
          {topNav}
          <div
            className="zd:flex zd:flex-1 zd:flex-col zd:min-h-0 zd:overflow-y-auto zd:overflow-x-hidden"
            style={{ paddingTop: `${CONTENT_PADDING_TOP}px` }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
