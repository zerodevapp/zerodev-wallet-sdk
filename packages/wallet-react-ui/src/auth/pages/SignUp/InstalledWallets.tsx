import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useConnect, useConnectors } from 'wagmi'
import { useAuth } from '../../hooks/useAuth'
import { isCancellationError } from '../../utils/isCancellationError'
import { matchesWallet, WALLET_GUIDE } from '../../walletGuide'
import { useReportPending, useSignUpContext } from './context'

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
  const { goToStep } = useAuth()
  const { authPending, guardAgreement, setError, registeredWallets } =
    useSignUpContext()
  const connectors = useConnectors()
  const { mutate: connect, isPending } = useConnect()
  useReportPending(isPending)

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

  const startConnect = (connector: (typeof connectors)[number]) => {
    if (authPending) return
    if (!guardAgreement()) return
    setError(null)
    connect(
      { connector },
      {
        // The external wallet is now the active wagmi connection — the
        // embedded-wallet flow is done, so close it (mirrors SignUp.Wallet).
        onSuccess: () => goToStep(null),
        onError: (err) => {
          if (!isCancellationError(err)) {
            setError(err instanceof Error ? err.message : String(err))
          }
        },
      },
    )
  }

  return (
    <>
      {rows.map(({ connector, name, icon }) => (
        <ListItem
          key={connector.uid}
          title={name}
          icon={
            icon ? <img src={icon} alt="" className="zd:w-6 zd:h-6" /> : null
          }
          subtitle={<Badge text="INSTALLED" />}
          trailing={<ListItemChevron />}
          disabled={authPending}
          onClick={() => startConnect(connector)}
        />
      ))}
    </>
  )
}
