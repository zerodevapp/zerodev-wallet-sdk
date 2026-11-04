import {
  BottomSheet,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTitle,
  Icon,
  Text,
} from '@zerodev/react-ui'

export type WalletTileData = {
  key: string
  name: string
  icon?: string | undefined
  onSelect: () => void
}

function WalletTile({ tile }: { tile: WalletTileData }) {
  return (
    <button
      type="button"
      onClick={tile.onSelect}
      className="zd:flex zd:flex-col zd:items-center zd:gap-1.5 zd:cursor-pointer"
    >
      <div className="zd:w-16 zd:h-16 zd:rounded-2xl zd:bg-inverse-hover zd:flex zd:items-center zd:justify-center">
        {tile.icon ? (
          <img src={tile.icon} alt="" className="zd:w-8 zd:h-8" />
        ) : (
          <Icon
            name="walletOutline"
            className="zd:w-8 zd:h-8 zd:icon-neutral-primary"
          />
        )}
      </div>
      <Text className="zd:text-body3 zd:max-w-full zd:truncate">
        {tile.name}
      </Text>
    </button>
  )
}

/** "More wallets" sheet: every guide wallet (plus live connectors
 * we have no guide entry for) as a scrollable 3-column tile grid, laid over
 * the sign-up page. Selection behavior is the caller's business. */
export function WalletGridSheet({
  open,
  onOpenChange,
  tiles,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tiles: WalletTileData[]
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="zd:p-4">
        <BottomSheetTitle>All wallets</BottomSheetTitle>
        <div className="zd:mb-3 zd:flex zd:items-center zd:gap-2">
          <Text className="zd:text-h3 zd:flex-1">All wallets</Text>
          <BottomSheetClose asChild>
            <button
              type="button"
              aria-label="Close"
              className="zd:cursor-pointer zd:px-2 zd:text-neutral-tertiary"
            >
              ✕
            </button>
          </BottomSheetClose>
        </div>
        <div className="zd:grid zd:grid-cols-3 zd:gap-3 zd:max-h-80 zd:overflow-y-auto">
          {tiles.map((tile) => (
            <WalletTile key={tile.key} tile={tile} />
          ))}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
