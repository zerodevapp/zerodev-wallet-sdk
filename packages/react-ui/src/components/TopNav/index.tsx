import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import type { IconName } from '../Icon'
import { IconButton } from '../IconButton'
import { Text } from '../Text'

export const TOP_NAV_HEIGHT = 52

export interface TopNavProps {
  /** Handler for the left icon button. When omitted, the left slot renders
   * an empty spacer so the title/logo stays centred. */
  onLeftButtonClick?: () => void
  /** Handler for the right icon button. When omitted, the right slot
   * renders an empty spacer. */
  onRightButtonClick?: () => void
  /** Icon rendered in the left slot. Defaults to `'chevronLeft'` (back). */
  leftButtonIcon?: IconName
  /** Icon rendered in the right slot. Defaults to `'x'` (close). */
  rightButtonIcon?: IconName
  title?: string
  logo?: ReactNode
  className?: string
}

export function TopNav({
  onLeftButtonClick,
  onRightButtonClick,
  leftButtonIcon = 'chevronLeft',
  rightButtonIcon = 'x',
  title,
  logo,
  className,
}: TopNavProps) {
  return (
    <div
      className={cn(
        // Spans the card edge-to-edge; internal px-4 aligns icons with
        // the scroll container's 16px inset.
        // No band of its own: the design's header is transparent, only the
        // icon buttons carry the frosted tile. Content scrolls under it.
        'zd:absolute zd:top-0 zd:left-0 zd:right-0 zd:z-20 zd:flex zd:flex-row zd:items-center zd:justify-between zd:px-4 zd:pt-4',
        className,
      )}
      // Scale via --zd-spacing (the 4px base) like every spacing utility, so
      // the nav height tracks the density variants and doesn't eat a
      // disproportionate share of the shrunken frame at smaller sizes.
      style={{
        height: `calc(${(TOP_NAV_HEIGHT + 24) / 4} * var(--zd-spacing))`,
      }}
    >
      {onLeftButtonClick ? (
        <IconButton iconName={leftButtonIcon} onClick={onLeftButtonClick} />
      ) : (
        <div className="zd:h-13 zd:w-13" />
      )}
      {logo && (
        <div className="zd:absolute zd:left-0 zd:right-0 zd:flex zd:items-center zd:justify-center zd:pointer-events-none">
          {logo}
        </div>
      )}
      {title && (
        <div className="zd:absolute zd:left-0 zd:right-0 zd:flex zd:items-center zd:justify-center zd:pointer-events-none">
          <Text className="zd:text-body1">{title}</Text>
        </div>
      )}
      {onRightButtonClick ? (
        <IconButton iconName={rightButtonIcon} onClick={onRightButtonClick} />
      ) : (
        <div className="zd:h-13 zd:w-13" />
      )}
    </div>
  )
}
