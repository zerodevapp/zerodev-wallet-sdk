import { useConnectors } from 'wagmi'
import { matchesWallet, WALLET_GUIDE } from '../../walletGuide'
import { useSignUpContext } from './context'

export type InstalledEvmRow = {
  connector: ReturnType<typeof useConnectors>[number]
  walletId: string | undefined
  name: string
  icon: string | undefined
  /** Every id the row answers to: guide id (when matched) and 6963 rdns. */
  ids: string[]
  /** Guide order; unknown extensions sort after every guide wallet. */
  rank: number
}

/**
 * Installed EVM wallets as list rows, ranked in guide order. The one rule for
 * "installed" that earns the INSTALLED badge elsewhere: only an EIP-6963
 * announcement proves a live extension. Announcements surface as injected-type
 * wagmi connectors with `id === rdns`; the generic `injected()` connector (id
 * "injected") and our own embedded-wallet connector (also type "injected")
 * exist regardless of installation. Wallets pinned through `SignUp.Wallet`
 * and the caller's `excludeWalletIds` are dropped.
 */
export function useInstalledEvmRows(
  excludeWalletIds: readonly string[],
): InstalledEvmRow[] {
  const { registeredWallets } = useSignUpContext()
  const connectors = useConnectors()
  return connectors
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
}
