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
}: {
  children: ReactNode
  className?: string | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex-1 flex flex-col relative overflow-hidden h-full w-[500px] rounded-[34px]',
        className,
      )}
      style={style}
    >
      <MultiRadialBackground />
      <div className="flex-1 bg-offWhite/85 m-1.5 px-4 overflow-hidden rounded-[30px] relative">
        {topNav}
        <div
          className="flex flex-1 flex-col h-full"
          style={{ paddingTop: `${CONTENT_PADDING_TOP}px` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
