import { ListItem, Text, walletConnectLogo } from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnect } from 'wagmi'
import { WalletSheet, type WalletSheetTarget } from '../components/WalletSheet'
import { useAuth } from '../hooks/useAuth'
import { useWalletConnectPairing } from '../hooks/useWalletConnectPairing'
import { matchesWallet, WALLET_GUIDE } from '../walletGuide'

export function WalletSelection() {
  const { goToStep } = useAuth()
  const { connect, connectors, isPending } = useConnect()
  const pairing = useWalletConnectPairing()
  const [sheet, setSheet] = useState<WalletSheetTarget | null>(null)

  // Exclude our own connector and the walletConnect one (kit-created or
  // dev-added) — the dedicated WalletConnect row covers that path; once the
  // pairing hook registers the connector it would otherwise show up as a
  // duplicate row here.
  const walletConnectors = connectors.filter(
    (c) => c.id !== 'zerodev-wallet' && c.type !== 'walletConnect',
  )

  // Dedupe: guide wallets claimed by a live connector sort first (keeping
  // their sheet with both connect paths); connectors we have no guide entry
  // for stay as plain direct-connect rows.
  const claimedWallets = WALLET_GUIDE.filter((wallet) =>
    walletConnectors.some((c) => matchesWallet(c, wallet)),
  )
  const unmatchedConnectors = walletConnectors.filter(
    (c) => !WALLET_GUIDE.some((wallet) => matchesWallet(c, wallet)),
  )
  const unclaimedWallets = WALLET_GUIDE.filter(
    (wallet) => !claimedWallets.includes(wallet),
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

  return (
    <div className="zd:flex-1 zd:flex zd:flex-col">
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:justify-center">
        <Text className="zd:text-h2 zd:text-center">Select your wallet</Text>

        <div className="zd:flex zd:flex-col zd:gap-2">
          {claimedWallets.map((wallet) => (
            <ListItem
              key={wallet.id}
              title={wallet.name}
              imageUri={wallet.icon}
              chevron
              disabled={isPending}
              {...(isAnnounced(wallet.rdns) && {
                badgeProps: { text: 'INSTALLED' },
              })}
              onClick={() => setSheet({ wallet })}
              className="zd:rounded-3xl"
            />
          ))}
          {unmatchedConnectors.map((connector) => (
            <ListItem
              key={connector.uid}
              title={connector.name}
              iconName="walletOutline"
              {...(connector.icon ? { imageUri: connector.icon } : {})}
              {...(connector.type === 'injected' && {
                badgeProps: { text: 'INSTALLED' },
              })}
              disabled={isPending}
              onClick={() => handleSelect(connector)}
              className="zd:rounded-3xl"
            />
          ))}
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
          {unclaimedWallets.map((wallet) => (
            <ListItem
              key={wallet.id}
              title={wallet.name}
              imageUri={wallet.icon}
              chevron
              disabled={isPending}
              onClick={() => setSheet({ wallet })}
              className="zd:rounded-3xl"
            />
          ))}
        </div>
      </div>

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
