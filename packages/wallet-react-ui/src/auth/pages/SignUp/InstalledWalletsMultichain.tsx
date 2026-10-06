import {
  Badge,
  ListItem,
  ListItemChevron,
  ListItemIcon,
} from '@zerodev/react-ui'
import { useState } from 'react'
import { sameWalletName } from '../../../shared/utils/sameWalletName'
import { useSolanaAutoReconnect } from '../../../solana/hooks/useSolanaAutoReconnect'
import { useSolanaWallets } from '../../../solana/hooks/useSolanaWallets'
import type { SolanaStandardWallet } from '../../../solana/types'
import { useAuth } from '../../hooks/useAuth'
import { WALLET_GUIDE } from '../../walletGuide'
import { useSignUpContext } from './context'
import {
  type InstalledEvmRow,
  useInstalledEvmRows,
} from './useInstalledEvmRows'
import { useSolanaConnect } from './useSolanaConnect'

export type InstalledWalletNamespace = 'eip155' | 'solana'

/** One row per installed wallet, across namespaces. A wallet that announces
 * both an EVM provider (EIP-6963) and a Solana wallet (Wallet Standard) under
 * the same name — Phantom — is one row with a chain choice. */
type Row = {
  key: string
  name: string
  icon: string | undefined
  evm: InstalledEvmRow | undefined
  solana: SolanaStandardWallet | undefined
  rank: number
}

/**
 * Multichain variant of `SignUp.InstalledWallets`, mounted when `namespaces`
 * includes `'solana'`. Lists EIP-6963 (EVM) and Wallet Standard (Solana)
 * wallets in one list, merged by name. A wallet present on both sides asks
 * which chain to connect, as Reown AppKit does for multichain wallets; a
 * wallet present on one side connects that side directly.
 */
export function InstalledWalletsMultichain({
  namespaces,
  excludeWalletIds,
  maxWallets,
}: {
  namespaces: readonly InstalledWalletNamespace[]
  excludeWalletIds: string[]
  maxWallets: number
}) {
  const { startWalletConnection } = useAuth()
  const { authPending, guardAgreement, registeredWallets } = useSignUpContext()
  const solanaWallets = useSolanaWallets()
  useSolanaAutoReconnect()
  const { connectSolana, pendingSolanaName, connectedSolanaName } =
    useSolanaConnect()
  // Name of the multichain wallet whose chain choice is expanded.
  const [choosing, setChoosing] = useState<string | null>(null)

  const withEvm = namespaces.includes('eip155')
  const withSolana = namespaces.includes('solana')

  const installedEvmRows = useInstalledEvmRows(excludeWalletIds)
  const evmRows = withEvm ? installedEvmRows : []
  // A wallet pinned through `SignUp.Wallet` is excluded by guide id on the
  // EVM side; its Solana registration carries the guide name instead.
  const registeredNames = registeredWallets.flatMap((id) => {
    const entry = WALLET_GUIDE.find((w) => w.id === id)
    return entry ? [entry.name] : []
  })

  const rows: Row[] = evmRows.map((evm) => ({
    key: evm.connector.uid,
    name: evm.name,
    icon: evm.icon,
    evm,
    solana: undefined,
    rank: evm.rank,
  }))

  if (withSolana) {
    for (const wallet of solanaWallets) {
      if (excludeWalletIds.some((id) => sameWalletName(id, wallet.name))) {
        continue
      }
      if (registeredNames.some((n) => sameWalletName(n, wallet.name))) continue
      const merged = rows.find((r) => sameWalletName(r.name, wallet.name))
      if (merged) {
        merged.solana = wallet
        merged.icon ??= wallet.icon
      } else {
        rows.push({
          key: `solana:${wallet.name}`,
          name: wallet.name,
          icon: wallet.icon,
          evm: undefined,
          solana: wallet,
          rank: WALLET_GUIDE.length,
        })
      }
    }
  }

  const visible = rows.sort((a, b) => a.rank - b.rank).slice(0, maxWallets)

  const connectEvm = (row: Row) => {
    if (!row.evm) return
    if (authPending) return
    if (!guardAgreement()) return
    setChoosing(null)
    startWalletConnection({
      connectorUid: row.evm.connector.uid,
      name: row.name,
      icon: row.icon,
    })
  }

  const connectSol = (row: Row) => {
    if (!row.solana) return
    setChoosing(null)
    // Settles through the shared hook (error takeover or closed flow).
    connectSolana(row.solana)
  }

  const onRowClick = (row: Row) => {
    if (authPending) return
    if (row.evm && row.solana) {
      setChoosing((current) => (current === row.name ? null : row.name))
      return
    }
    if (row.solana) connectSol(row)
    else connectEvm(row)
  }

  const badgesFor = (row: Row) => {
    const isSolanaConnected =
      !!row.solana && connectedSolanaName === row.solana.name
    const isSolanaPending =
      !!row.solana && pendingSolanaName === row.solana.name
    return (
      <span className="zd:flex zd:gap-1">
        {row.evm && <Badge text="EVM" variant="secondary" />}
        {row.solana && <Badge text="SOLANA" variant="secondary" />}
        <Badge
          text={
            isSolanaConnected
              ? 'CONNECTED'
              : isSolanaPending
                ? 'CONNECTING'
                : 'INSTALLED'
          }
        />
      </span>
    )
  }

  return (
    <>
      {visible.map((row) => {
        const expanded = choosing === row.name && !!row.evm && !!row.solana
        return (
          <div key={row.key} className="zd:flex zd:flex-col zd:gap-2">
            <ListItem
              title={row.name}
              icon={
                row.icon ? (
                  <img src={row.icon} alt="" className="zd:w-6 zd:h-6" />
                ) : null
              }
              subtitle={badgesFor(row)}
              trailing={<ListItemChevron />}
              disabled={
                authPending ||
                (!row.evm && connectedSolanaName === row.solana?.name)
              }
              onClick={() => onRowClick(row)}
            />
            {expanded && (
              <div
                className="zd:flex zd:flex-col zd:gap-2 zd:pl-8"
                data-testid={`chain-choice-${row.name}`}
              >
                <ListItem
                  title="Ethereum"
                  icon={<ListItemIcon name="ethereum" />}
                  subtitle={<Badge text="EVM" variant="secondary" />}
                  trailing={<ListItemChevron />}
                  disabled={authPending}
                  onClick={() => connectEvm(row)}
                />
                <ListItem
                  title="Solana"
                  icon={<ListItemIcon name="solana" />}
                  subtitle={<Badge text="SOLANA" variant="secondary" />}
                  trailing={<ListItemChevron />}
                  disabled={authPending || connectedSolanaName === row.name}
                  onClick={() => connectSol(row)}
                />
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
