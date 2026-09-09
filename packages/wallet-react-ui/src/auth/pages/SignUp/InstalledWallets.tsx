import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useConnectors } from 'wagmi'
import { useAuth } from '../../hooks/useAuth'
import { matchesWallet, WALLET_GUIDE } from '../../walletGuide'
import { useSignUpContext } from './context'

/** Auto-discovered rows for installed wallets: one row per announced (6963)
 * browser extension. Renders nothing when no wallet is installed. */
export function SignUpInstalledWallets({
  excludeWalletIds = [],
  maxWallets = 4,
}: {
  /** Wallets to hide, by guide id (e.g. `'metamask'`) or EIP-6963 rdns.
   * Pinned `SignUp.Wallet` rows are excluded automatically. */
  excludeWalletIds?: string[]
  /** Cap on the number of rendered rows (default 4). Guide wallets rank
   * first, in guide order, so the cut drops unknown extensions before
   * curated ones. */
  maxWallets?: number
}) {
  const { startWalletConnect } = useAuth()
  const { authPending, guardAgreement, registeredWallets } = useSignUpContext()
  const connectors = useConnectors()

  // Same rule that earns the INSTALLED badge elsewhere: only a 6963
  // announcement proves a live extension. Announcements surface as
  // injected-type connectors with `id === rdns`; the generic `injected()`
  // connector (id "injected") and our own embedded-wallet connector (which
  // also claims type "injected") exist regardless of installation.
  const rows = connectors
    .filter(
      (c) =>
        c.type === 'injected' &&
        c.id !== 'injected' &&
        c.id !== 'zerodev-wallet',
    )
    .map((connector) => {
      const wallet = WALLET_GUIDE.find((w) => matchesWallet(connector, w))
      return {
        connector,
        walletId: wallet?.id,
        name: wallet?.name ?? connector.name,
        icon: wallet?.icon ?? connector.icon,
        ids: wallet ? [wallet.id, connector.id] : [connector.id],
        rank: wallet ? WALLET_GUIDE.indexOf(wallet) : WALLET_GUIDE.length,
      }
    })
    .filter(
      (row) => !(row.walletId && registeredWallets.includes(row.walletId)),
    )
    .filter((row) => !row.ids.some((id) => excludeWalletIds.includes(id)))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxWallets)

  // Hand off to the `wallet-connecting` step, which owns the connect() call
  // and stays usable however the wallet responds.
  const startConnect = (row: (typeof rows)[number]) => {
    if (authPending) return
    if (!guardAgreement()) return
    startWalletConnect({
      connectorUid: row.connector.uid,
      name: row.name,
      icon: row.icon,
    })
  }

  return (
    <>
      {rows.map((row) => (
        <ListItem
          key={row.connector.uid}
          title={row.name}
          icon={
            row.icon ? (
              <img src={row.icon} alt="" className="zd:w-6 zd:h-6" />
            ) : null
          }
          subtitle={<Badge text="INSTALLED" />}
          trailing={<ListItemChevron />}
          disabled={authPending}
          onClick={() => startConnect(row)}
        />
      ))}
    </>
  )
}
