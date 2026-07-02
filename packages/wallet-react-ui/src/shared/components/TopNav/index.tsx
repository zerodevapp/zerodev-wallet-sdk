import { cn, IconButton, Text } from '@zerodev/react-ui'
import type { ReactNode } from 'react'

export const TOP_NAV_HEIGHT = 52

export function TopNav({
  onBack,
  onClose,
  title,
  logo,
  className,
}: {
  onBack?: () => void
  onClose: () => void
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
      style={{ height: TOP_NAV_HEIGHT }}
    >
      {onBack ? (
        <IconButton iconName="chevronLeft" onClick={onBack} />
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
