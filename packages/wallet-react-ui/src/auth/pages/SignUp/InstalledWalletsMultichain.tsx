import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnectors } from 'wagmi'
import { useSolanaAutoReconnect } from '../../../solana/hooks/useSolanaAutoReconnect'
import { useSolanaWallets } from '../../../solana/hooks/useSolanaWallets'
import type { SolanaStandardWallet } from '../../../solana/types'
import { useAuth } from '../../hooks/useAuth'
import { matchesWallet, WALLET_GUIDE } from '../../walletGuide'
import { useSignUpContext } from './context'
import { useSolanaConnect } from './useSolanaConnect'

export type InstalledWalletNamespace = 'eip155' | 'solana'

type EvmRow = {
  connector: ReturnType<typeof useConnectors>[number]
  walletId: string | undefined
  name: string
  icon: string | undefined
  ids: string[]
  rank: number
}

/** One row per installed wallet, across namespaces. A wallet that announces
 * both an EVM provider (EIP-6963) and a Solana wallet (Wallet Standard) under
 * the same name — Phantom — is one row with a chain choice. */
type Row = {
  key: string
  name: string
  icon: string | undefined
  evm: EvmRow | undefined
  solana: SolanaStandardWallet | undefined
  rank: number
}

const sameWallet = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

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
  const connectors = useConnectors()
  const solanaWallets = useSolanaWallets()
  useSolanaAutoReconnect()
  const { connectSolana, pendingSolanaName, connectedSolanaName } =
    useSolanaConnect()
  // Name of the multichain wallet whose chain choice is expanded.
  const [choosing, setChoosing] = useState<string | null>(null)

  const withEvm = namespaces.includes('eip155')
  const withSolana = namespaces.includes('solana')

  // Same rule as the EVM-only unit: only a 6963 announcement proves a live
  // extension.
  const evmRows: EvmRow[] = withEvm
    ? connectors
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
    : []

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
      if (excludeWalletIds.some((id) => sameWallet(id, wallet.name))) continue
      const merged = rows.find((r) => sameWallet(r.name, wallet.name))
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
              disabled={authPending}
              onClick={() => onRowClick(row)}
            />
            {expanded && (
              <div
                className="zd:flex zd:flex-col zd:gap-2 zd:pl-8"
                data-testid={`chain-choice-${row.name}`}
              >
                <ListItem
                  title="Ethereum"
                  subtitle={<Badge text="EVM" variant="secondary" />}
                  trailing={<ListItemChevron />}
                  disabled={authPending}
                  onClick={() => connectEvm(row)}
                />
                <ListItem
                  title="Solana"
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
