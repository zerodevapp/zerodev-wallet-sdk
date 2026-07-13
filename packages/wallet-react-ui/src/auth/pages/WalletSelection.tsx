import { ListItem, Text, walletConnectLogo } from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnect } from 'wagmi'
import { WalletGridSheet } from '../components/WalletGridSheet'
import { WalletSheet, type WalletSheetTarget } from '../components/WalletSheet'
import { useAuth } from '../hooks/useAuth'
import { useWalletConnectPairing } from '../hooks/useWalletConnectPairing'
import {
  matchesWallet,
  WALLET_GUIDE,
  type WalletGuideEntry,
} from '../walletGuide'

// The short list shown on the page; everything else lives behind
// "Browse more wallets". WalletConnect slots in after MetaMask.
const CURATED_WALLET_IDS = ['metaMask', 'trust', 'coinbase', 'rainbow', 'rabby']

export function WalletSelection() {
  const { goToStep } = useAuth()
  const { connect, connectors, isPending } = useConnect()
  const pairing = useWalletConnectPairing()
  const [sheet, setSheet] = useState<WalletSheetTarget | null>(null)
  const [gridOpen, setGridOpen] = useState(false)

  // Exclude our own connector and the walletConnect one (kit-created or
  // dev-added) — the dedicated WalletConnect row covers that path; once the
  // pairing hook registers the connector it would otherwise show up as a
  // duplicate row here.
  const walletConnectors = connectors.filter(
    (c) => c.id !== 'zerodev-wallet' && c.type !== 'walletConnect',
  )

  // Live connectors we have no guide entry for — reachable via the grid.
  const unmatchedConnectors = walletConnectors.filter(
    (c) => !WALLET_GUIDE.some((wallet) => matchesWallet(c, wallet)),
  )

  // A 6963 announcement (connector id === rdns) proves a live extension; a
  // configured SDK connector merely claims the rdns and exists regardless of
  // installation — only announcements earn the INSTALLED badge.
  const isAnnounced = (rdns: string | undefined) =>
    !!rdns && walletConnectors.some((c) => c.id === rdns)

  const handleSelect = (connector: (typeof connectors)[number]) => {
    connect(
      { connector },
      {
        onSuccess: () => {
          goToStep(null)
        },
      },
    )
  }

  const openWalletSheet = (wallet: WalletGuideEntry) => {
    setGridOpen(false)
    setSheet({ wallet })
  }

  const curatedWallets = CURATED_WALLET_IDS.flatMap((id) => {
    const wallet = WALLET_GUIDE.find((w) => w.id === id)
    return wallet ? [wallet] : []
  })
  const [metaMask, ...restCurated] = curatedWallets

  const walletRow = (wallet: WalletGuideEntry) => (
    <ListItem
      key={wallet.id}
      title={wallet.name}
      imageUri={wallet.icon}
      chevron
      disabled={isPending}
      {...(isAnnounced(wallet.rdns) && {
        badgeProps: { text: 'INSTALLED' },
      })}
      onClick={() => openWalletSheet(wallet)}
      className="zd:rounded-3xl"
    />
  )

  return (
    <div className="zd:flex-1 zd:flex zd:flex-col">
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:justify-center">
        <Text className="zd:text-h2 zd:text-center">Select your wallet</Text>

        <div className="zd:flex zd:flex-col zd:gap-2">
          {metaMask && walletRow(metaMask)}
          {pairing.enabled && (
            <ListItem
              title="WalletConnect"
              imageUri={walletConnectLogo}
              badgeProps={{ text: 'QR CODE' }}
              chevron
              disabled={isPending}
              onClick={() => setSheet({})}
              className="zd:rounded-3xl"
            />
          )}
          {restCurated.map(walletRow)}

          <ListItem
            title="Browse more wallets"
            iconName="walletOutline"
            chevron
            disabled={isPending}
            onClick={() => setGridOpen(true)}
            className="zd:rounded-3xl"
          />
        </div>
      </div>

      <WalletGridSheet
        open={gridOpen}
        connectors={unmatchedConnectors}
        onSelectWallet={openWalletSheet}
        onSelectConnector={(connector) => {
          setGridOpen(false)
          handleSelect(connector)
        }}
        onClose={() => setGridOpen(false)}
      />

      <WalletSheet
        target={sheet}
        uri={pairing.uri}
        error={pairing.error}
        connectors={walletConnectors}
        onSelectConnector={handleSelect}
        onRetry={pairing.retry}
        onClose={() => setSheet(null)}
      />
    </div>
  )
}
