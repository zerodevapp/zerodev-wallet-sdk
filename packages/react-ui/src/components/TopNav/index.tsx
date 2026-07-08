import type { ReactNode } from 'react'
import { cn } from '../../utils/common'
import { IconButton } from '../IconButton'
import { Text } from '../Text'

export const TOP_NAV_HEIGHT = 52

export function TopNav({
  onBack,
  onClose,
  onHelp,
  title,
  logo,
  className,
}: {
  onBack?: () => void
  onClose: () => void
  onHelp?: () => void
  title?: string
  logo?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'zd:absolute zd:top-4 zd:left-0 zd:right-0 zd:flex zd:flex-row zd:items-center zd:justify-between',
        className,
      )}
      // Scale via --zd-spacing (the 4px base) like every spacing utility, so
      // the nav height tracks the density variants and doesn't eat a
      // disproportionate share of the shrunken frame at smaller sizes.
      style={{ height: `calc(${TOP_NAV_HEIGHT / 4} * var(--zd-spacing))` }}
    >
      {onBack ? (
        <IconButton iconName="chevronLeft" onClick={onBack} />
      ) : onHelp ? (
        <IconButton iconName="question" onClick={onHelp} />
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
      <IconButton iconName="x" onClick={onClose} />
    </div>
  )
}
