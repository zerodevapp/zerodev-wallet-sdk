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
}: {
  children: (props: ChildrenProps) => React.ReactNode
}) {
  const paddingBottom = BOTTOM_TAB_HEIGHT + BOTTOM_TAB_MARGIN + 10
  const paddingTop = TOP_NAV_HEIGHT + 20

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden h-full">
      <MultiRadialBackground />
      <div className="flex-1 bg-[#F7F5F0CC] m-1.5 px-4 overflow-hidden rounded-[30px] relative">
        {children({ paddingTop, paddingBottom })}
      </div>
    </div>
  )
}
