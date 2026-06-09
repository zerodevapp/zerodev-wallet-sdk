import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../utils/common'
import { TOP_NAV_HEIGHT } from '../TopNav'
import { MultiRadialBackground } from './MultiRadialBackground'

const CONTENT_PADDING_TOP = TOP_NAV_HEIGHT + 20

export function ScreenWrapper({
  children,
  className,
  style,
  topNav,
  overlay,
}: {
  children: ReactNode
  className?: string | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
  /**
   * Rendered as a sibling of the inner content at the outer card level —
   * lets a modal `absolute inset-0` over everything (including the TopNav)
   * without leaking outside the card's rounded boundary.
   */
  overlay?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex-1 flex flex-col relative overflow-hidden min-h-screen w-full sm:w-[500px] rounded-[34px] text-left sm:min-h-0 sm:h-full',
        className,
      )}
      style={style}
    >
      <MultiRadialBackground />
      <div className="flex flex-1 flex-col bg-offWhite/85 m-1.5 px-4 overflow-hidden rounded-[30px] relative">
        {topNav}
        <div
          className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ paddingTop: `${CONTENT_PADDING_TOP}px` }}
        >
          {children}
        </div>
      </div>
      {overlay}
    </div>
  )
}
