import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../utils/common'
import { MultiRadialBackground } from './MultiRadialBackground'

interface ChildrenProps {
  paddingTop: number
  paddingBottom: number
}

const TOP_NAV_HEIGHT = 52
const BOTTOM_TAB_HEIGHT = 56
const BOTTOM_TAB_MARGIN = 20

export function ScreenWrapper({
  children,
  className,
  style,
  topNav,
}: {
  children: (props: ChildrenProps) => React.ReactNode
  className?: string | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
}) {
  const paddingBottom = BOTTOM_TAB_HEIGHT + BOTTOM_TAB_MARGIN + 10
  const paddingTop = TOP_NAV_HEIGHT + 20

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
        {children({ paddingTop, paddingBottom })}
      </div>
    </div>
  )
}
