import { ListItem, ListItemChevron, ListItemIcon } from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnectors } from 'wagmi'
import { walletConnectLogo } from '../../brandAssets'
import {
  WalletGridSheet,
  type WalletTileData,
} from '../../components/WalletGridSheet'
import { useAuth } from '../../hooks/useAuth'
import { isZeroDevWalletConnect } from '../../utils/isZeroDevWalletConnect'
import { announcesWallet, matchesWallet, WALLET_GUIDE } from '../../walletGuide'
import { useSignUpContext } from './context'

/** "More wallets" row — opens the wallet grid sheet. */
export function SignUpMoreWallets({
  title = 'More wallets',
}: {
  title?: string
}) {
  const { startWalletConnect } = useAuth()
  const { authPending, guardAgreement, openWalletSheet } = useSignUpContext()
  const [open, setOpen] = useState(false)
  const connectors = useConnectors()

  // Our own connector is the embedded wallet, and walletConnect-type
  // connectors are the mobile transport rather than a wallet — neither
  // belongs in the grid.
  const walletConnectors = connectors.filter(
    (c) => c.id !== 'zerodev-wallet' && c.type !== 'walletConnect',
  )

  // Hand off to the `wallet-connecting` step, which owns the connect() call.
  const startConnect = (
    connector: (typeof connectors)[number],
    name: string,
    icon: string | undefined,
  ) => {
    if (authPending) return
    if (!guardAgreement()) return
    setOpen(false)
    startWalletConnect({ connectorUid: connector.uid, name, icon })
  }

  const wcEnabled = connectors.some(isZeroDevWalletConnect)

  const guideTiles: WalletTileData[] = WALLET_GUIDE.map((wallet) => {
    const announced = walletConnectors.find((c) => announcesWallet(c, wallet))
    return {
      key: wallet.id,
      name: wallet.name,
      icon: wallet.icon,
      onSelect: () => {
        // Announced = the wallet is live on this page (extension or its own
        // in-app browser) — connect directly instead of a WC handoff.
        if (announced) {
          startConnect(announced, wallet.name, wallet.icon)
          return
        }
        if (wcEnabled) {
          if (authPending) return
          if (!guardAgreement()) return
          setOpen(false)
          openWalletSheet(wallet)
          return
        }
        // No WC handoff available — a configured connector that claims the
        // wallet (e.g. a vendor SDK) is the last way to connect.
        const claimed = walletConnectors.find((c) => matchesWallet(c, wallet))
        if (claimed) {
          startConnect(claimed, wallet.name, wallet.icon)
          return
        }
        setOpen(false)
        window.open(wallet.downloadUrl, '_blank', 'noopener,noreferrer')
      },
    }
  })

  // Live connectors we have no guide entry for still get a tile — nothing
  // installed is ever hidden.
  const connectorTiles: WalletTileData[] = walletConnectors
    .filter((c) => !WALLET_GUIDE.some((wallet) => matchesWallet(c, wallet)))
    .map((connector) => ({
      key: connector.uid,
      name: connector.name,
      icon: connector.icon,
      onSelect: () => startConnect(connector, connector.name, connector.icon),
    }))

  const walletConnectTiles: WalletTileData[] = wcEnabled
    ? [
        {
          key: 'walletconnect',
          name: 'WalletConnect',
          icon: walletConnectLogo,
          onSelect: () => {
            if (authPending) return
            if (!guardAgreement()) return
            setOpen(false)
            openWalletSheet()
          },
        },
      ]
    : []

  const handleClick = () => {
    if (authPending) return
    if (!guardAgreement()) return
    setOpen(true)
  }

  return (
    <>
      <ListItem
        icon={<ListItemIcon name="walletOutline" className="zd:w-5 zd:h-5" />}
        title={title}
        trailing={<ListItemChevron />}
        disabled={authPending}
        onClick={handleClick}
      />
      <WalletGridSheet
        open={open}
        onOpenChange={setOpen}
        tiles={[...walletConnectTiles, ...guideTiles, ...connectorTiles]}
      />
    </>
  )
}
