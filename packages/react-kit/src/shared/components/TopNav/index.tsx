import { IconButton } from '../IconButton'
import { Text } from '../Text'

export const TOP_NAV_HEIGHT = 52

export function TopNav({
  onBack,
  onClose,
  title,
}: {
  onBack?: () => void
  onClose: () => void
  title?: string
}) {
  return (
    <div
      className="absolute top-5 left-[22px] right-[22px] flex flex-row items-center justify-between"
      style={{ height: TOP_NAV_HEIGHT }}
    >
      {onBack ? (
        <IconButton iconName="chevronLeft" onClick={onBack} />
      ) : (
        <div className="h-13 w-13" />
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
