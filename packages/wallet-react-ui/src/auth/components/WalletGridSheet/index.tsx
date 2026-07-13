import { Icon, Text } from '@zerodev/react-ui'
import type { Connector } from 'wagmi'
import { WALLET_GUIDE, type WalletGuideEntry } from '../../walletGuide'
import { SheetShell } from '../WalletSheet/SheetShell'

function WalletTile({
  icon,
  name,
  onClick,
}: {
  icon?: string | undefined
  name: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="zd:flex zd:flex-col zd:items-center zd:gap-1.5 zd:cursor-pointer"
    >
      <div className="zd:w-16 zd:h-16 zd:rounded-2xl zd:bg-white zd:flex zd:items-center zd:justify-center">
        {icon ? (
          <img src={icon} alt="" className="zd:w-8 zd:h-8" />
        ) : (
          <Icon
            name="walletOutline"
            className="zd:w-8 zd:h-8 zd:text-greyScale"
          />
        )}
      </div>
      <Text className="zd:text-body3 zd:max-w-full zd:truncate">{name}</Text>
    </button>
  )
}

/**
 * "Browse more wallets" sheet: every guide wallet (plus live connectors we
 * have no guide entry for) in a scrollable 3-column grid. Picking a guide
 * wallet hands off to the connection-details sheet; picking a bare connector
 * connects directly.
 */
export function WalletGridSheet({
  open,
  connectors,
  onSelectWallet,
  onSelectConnector,
  onClose,
}: {
  open: boolean
  connectors: readonly Connector[]
  onSelectWallet: (wallet: WalletGuideEntry) => void
  onSelectConnector: (connector: Connector) => void
  onClose: () => void
}) {
  return (
    <SheetShell open={open} onClose={onClose}>
      <div className="zd:flex zd:w-full zd:items-center zd:gap-2">
        <Text className="zd:text-h3 zd:flex-1">All wallets</Text>
        <button
          type="button"
          onClick={onClose}
          className="zd:cursor-pointer zd:px-2 zd:text-greyScale/60"
        >
          ✕
        </button>
      </div>

      <div className="zd:grid zd:grid-cols-3 zd:gap-3 zd:w-full zd:max-h-80 zd:overflow-y-auto">
        {WALLET_GUIDE.map((wallet) => (
          <WalletTile
            key={wallet.id}
            icon={wallet.icon}
            name={wallet.name}
            onClick={() => onSelectWallet(wallet)}
          />
        ))}
        {connectors.map((connector) => (
          <WalletTile
            key={connector.uid}
            icon={connector.icon}
            name={connector.name}
            onClick={() => onSelectConnector(connector)}
          />
        ))}
      </div>
    </SheetShell>
  )
}
