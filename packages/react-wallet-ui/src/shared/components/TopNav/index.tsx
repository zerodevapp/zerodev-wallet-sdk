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
        'absolute top-4 left-0 right-0 flex flex-row items-center justify-between',
        className,
      )}
      style={{ height: TOP_NAV_HEIGHT }}
    >
      {onBack ? (
        <IconButton iconName="chevronLeft" onClick={onBack} />
      ) : (
        <div className="h-13 w-13" />
      )}
      {centerLogo && (
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
          <Icon name="zerodevLogo" className="h-8 w-auto" />
        </div>
      )}
      {title && (
        <div className="absolute left-0 right-0 flex items-center justify-center pointer-events-none">
          <Text className="text-body1">{title}</Text>
        </div>
      )}
      <IconButton iconName="x" onClick={onClose} />
    </div>
  )
}
