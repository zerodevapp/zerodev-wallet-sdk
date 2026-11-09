import {
  Badge,
  ListItem,
  ListItemChevron,
  ListItemIcon,
} from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnections } from 'wagmi'
import { equalsIgnoreCase } from '../../../shared/utils/common'
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
  // A reload that lands on a sheet offering Solana restores the last Solana
  // wallet; a sheet without a Solana unit restores nothing.
  useSolanaAutoReconnect()
  const { connectSolana, pendingSolanaName, connectedSolanaName } =
    useSolanaConnect()
  // The EVM side's connected wallets, so a wallet already connected there
  // reads as connected and cannot be connected again, as on the Solana
  // side. The host adds the other side from this list.
  const connections = useConnections()
  const connectedEvmUids = new Set(connections.map((c) => c.connector.uid))
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
      if (excludeWalletIds.some((id) => equalsIgnoreCase(id, wallet.name))) {
        continue
      }
      if (registeredNames.some((n) => equalsIgnoreCase(n, wallet.name)))
        continue
      const merged = rows.find((r) => equalsIgnoreCase(r.name, wallet.name))
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

  const isEvmConnected = (row: Row) =>
    !!row.evm && connectedEvmUids.has(row.evm.connector.uid)
  const isSolanaConnected = (row: Row) =>
    !!row.solana && connectedSolanaName === row.solana.name
  /** A side is left to connect. */
  const isConnectable = (row: Row) =>
    (!!row.evm && !isEvmConnected(row)) ||
    (!!row.solana && !isSolanaConnected(row))

  const connectEvm = (row: Row) => {
    if (!row.evm || isEvmConnected(row)) return
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
    if (!row.solana || isSolanaConnected(row)) return
    setChoosing(null)
    // Settles through the shared hook (error takeover or closed flow).
    connectSolana(row.solana)
  }

  const onRowClick = (row: Row) => {
    if (authPending || !isConnectable(row)) return
    if (row.evm && row.solana) {
      setChoosing((current) => (current === row.name ? null : row.name))
      return
    }
    if (row.solana) connectSol(row)
    else connectEvm(row)
  }

  const badgesFor = (row: Row) => {
    const isSolanaPending =
      !!row.solana && pendingSolanaName === row.solana.name
    return (
      <span className="zd:flex zd:gap-1">
        {row.evm && <Badge text="EVM" variant="secondary" />}
        {row.solana && <Badge text="SOLANA" variant="secondary" />}
        <Badge
          text={
            isSolanaConnected(row) || isEvmConnected(row)
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
              disabled={authPending || !isConnectable(row)}
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
                  disabled={authPending || isEvmConnected(row)}
                  onClick={() => connectEvm(row)}
                />
                <ListItem
                  title="Solana"
                  icon={<ListItemIcon name="solana" />}
                  subtitle={<Badge text="SOLANA" variant="secondary" />}
                  trailing={<ListItemChevron />}
                  disabled={authPending || isSolanaConnected(row)}
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
