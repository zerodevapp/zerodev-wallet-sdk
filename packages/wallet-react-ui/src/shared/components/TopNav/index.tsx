import { cn, Icon, IconButton, Text } from '@zerodev/react-ui'

export const TOP_NAV_HEIGHT = 52

export function TopNav({
  onBack,
  onClose,
  title,
  centerLogo,
  className,
}: {
  onBack?: () => void
  onClose: () => void
  title?: string
  centerLogo?: boolean
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
      {centerLogo && (
        <div className="zd:absolute zd:left-0 zd:right-0 zd:flex zd:items-center zd:justify-center zd:pointer-events-none">
          <Icon name="zerodevLogo" className="zd:h-8 zd:w-auto" />
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
