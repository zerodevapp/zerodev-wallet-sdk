import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useAuth } from '../../hooks/useAuth'
import { useSignUpContext } from './context'
import {
  type InstalledWalletNamespace,
  InstalledWalletsMultichain,
} from './InstalledWalletsMultichain'
import {
  type InstalledEvmRow,
  useInstalledEvmRows,
} from './useInstalledEvmRows'

/** Auto-discovered rows for installed wallets: one row per announced (6963)
 * browser extension. Renders nothing when no wallet is installed.
 *
 * With `namespaces` including `'solana'`, Solana wallets announced through
 * the Wallet Standard (Phantom, Solflare, Backpack, …) are listed too, merged
 * by name: a wallet installed for both EVM and Solana is one row that asks
 * which chain to connect. */
export function SignUpInstalledWallets({
  excludeWalletIds = [],
  maxWallets = 4,
  namespaces = ['eip155'],
}: {
  /** Wallets to hide, by guide id (e.g. `'metamask'`), EIP-6963 rdns, or —
   * for Solana wallets — the name they register under (`'Phantom'`).
   * Pinned `SignUp.Wallet` rows are excluded automatically. */
  excludeWalletIds?: string[]
  /** Cap on the number of rendered rows (default 4). Guide wallets rank
   * first, in guide order, so the cut drops unknown extensions before
   * curated ones. */
  maxWallets?: number
  /** Which chain families to discover (default `['eip155']`, EVM only).
   * Add `'solana'` to list Wallet Standard wallets as well. */
  namespaces?: readonly InstalledWalletNamespace[]
}) {
  if (namespaces.includes('solana')) {
    return (
      <InstalledWalletsMultichain
        namespaces={namespaces}
        excludeWalletIds={excludeWalletIds}
        maxWallets={maxWallets}
      />
    )
  }
  return (
    <InstalledWalletsEvm
      excludeWalletIds={excludeWalletIds}
      maxWallets={maxWallets}
    />
  )
}

/** The original EVM-only list: EIP-6963 announcements as wagmi connectors. */
function InstalledWalletsEvm({
  excludeWalletIds,
  maxWallets,
}: {
  excludeWalletIds: string[]
  maxWallets: number
}) {
  const { startWalletConnection } = useAuth()
  const { authPending, guardAgreement } = useSignUpContext()
  const rows = useInstalledEvmRows(excludeWalletIds).slice(0, maxWallets)

  // Hand off to the `wallet-connecting` step, which owns the connect() call.
  const startConnect = (row: InstalledEvmRow) => {
    if (authPending) return
    if (!guardAgreement()) return
    startWalletConnection({
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
