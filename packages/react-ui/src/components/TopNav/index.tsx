import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import { IconButton } from '../IconButton'
import { Text } from '../Text'

export const TOP_NAV_HEIGHT = 52

/**
 * The 52px header row used at the top of a `Screen`. Left slot renders (in
 * priority order) a back button when `onBack` is supplied, a help button when
 * `onHelp` is supplied, or an empty spacer. Center renders the `logo` node or
 * the `title` text. Right slot always renders a close button.
 */
export function TopNav({
  onBack,
  onHelp,
  onClose,
  title,
  logo,
  className,
}: {
  onBack?: (() => void) | undefined
  onHelp?: (() => void) | undefined
  onClose: () => void
  title?: string | undefined
  logo?: ReactNode
  className?: string | undefined
}) {
  return (
    <div
      className={cn(
        'zd:absolute zd:top-4 zd:left-0 zd:right-0 zd:flex zd:flex-row zd:items-center zd:justify-between',
        className,
      )}
      style={{ height: TOP_NAV_HEIGHT }}
    >
      {onBack ? (
        <IconButton iconName="chevronLeft" onClick={onBack} />
      ) : onHelp ? (
        <IconButton iconName="question" onClick={onHelp} aria-label="Help" />
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
      <IconButton iconName="x" onClick={onClose} aria-label="Close" />
    </div>
  )
}
