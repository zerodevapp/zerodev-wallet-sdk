import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useLayoutEffect, useState } from 'react'
import { useConnections, useConnectors } from 'wagmi'
import { equalsIgnoreCase } from '../../../shared/utils/common'
import { useSolanaAutoReconnect } from '../../../solana/hooks/useSolanaAutoReconnect'
import { useSolanaWallets } from '../../../solana/hooks/useSolanaWallets'
import { useAuth } from '../../hooks/useAuth'
import { isZeroDevWalletConnect } from '../../utils/isZeroDevWalletConnect'
import {
  announcesWallet,
  matchesWallet,
  WALLET_GUIDE,
  type WalletGuideEntry,
  type WalletId,
} from '../../walletGuide'
import { ChainChoice, MultichainBadges } from './ChainChoice'
import { useSignUpContext } from './context'
import type { InstalledWalletNamespace } from './InstalledWalletsMultichain'
import { useSolanaConnect } from './useSolanaConnect'

/** Dedicated row for a single guide wallet: connects it directly when a live
 * connector claims it, and is a download link for the vendor page otherwise.
 *
 * With `namespaces` including `'solana'`, the wallet's Wallet Standard
 * registration counts too: a wallet installed for both EVM and Solana
 * (MetaMask, Phantom) asks which chain to connect, and one installed for
 * Solana only connects that side directly. Without `'eip155'` in the list
 * the row offers Solana alone: no chain choice, and no EVM fallback. */
export function SignUpWallet({
  walletId,
  namespaces = ['eip155'],
}: {
  walletId: WalletId
  /** Which chain families the row connects (default `['eip155']`, EVM
   * only). Add `'solana'` to offer the wallet's Solana side as well, or
   * pass `['solana']` for that side alone. */
  namespaces?: readonly InstalledWalletNamespace[]
}) {
  const wallet = WALLET_GUIDE.find((w) => w.id === walletId)
  if (!wallet) {
    // Unreachable for TS consumers; catches raw-JS typos.
    throw new Error(
      `Unknown walletId "${walletId}". Valid ids: ${WALLET_GUIDE.map((w) => w.id).join(', ')}`,
    )
  }

  const { registerWallet } = useSignUpContext()
  useLayoutEffect(() => registerWallet(wallet.id), [registerWallet, wallet.id])

  if (namespaces.includes('solana')) {
    return (
      <SignUpWalletMultichain
        wallet={wallet}
        withEvm={namespaces.includes('eip155')}
      />
    )
  }
  return <SignUpWalletEvm wallet={wallet} />
}

/** The row for a wallet that is not here: a link to the vendor's download
 * page. */
function WalletDownloadRow({ wallet }: { wallet: WalletGuideEntry }) {
  return (
    <ListItem
      title={wallet.name}
      icon={<img src={wallet.icon} alt="" className="zd:w-6 zd:h-6" />}
      trailing={<ListItemChevron />}
      asChild
    >
      {/* biome-ignore lint/a11y/useAnchorContent: the row layout (incl. the title text) is injected into the anchor via Slot */}
      <a href={wallet.downloadUrl} target="_blank" rel="noopener noreferrer" />
    </ListItem>
  )
}

/** The EVM-only row: a claiming wagmi connector, the pairing sheet, or the
 * download link. */
function SignUpWalletEvm({ wallet }: { wallet: WalletGuideEntry }) {
  const { startWalletConnection } = useAuth()
  const { authPending, guardAgreement, openWalletSheet } = useSignUpContext()
  const connectors = useConnectors()

  // Only a 6963 announcement proves a live extension (or the wallet's own
  // in-app browser) — it earns the badge and a direct connect.
  const announced = connectors.find((c) => announcesWallet(c, wallet))

  const shared = {
    title: wallet.name,
    icon: <img src={wallet.icon} alt="" className="zd:w-6 zd:h-6" />,
    trailing: <ListItemChevron />,
  }

  // An announcement means the wallet is right here (extension, or its own
  // in-app browser) — connect it directly; WC pairing would bounce out of
  // the very wallet the user is standing in.
  if (!announced && connectors.some(isZeroDevWalletConnect)) {
    return (
      <ListItem
        {...shared}
        disabled={authPending}
        onClick={() => {
          if (authPending) return
          if (!guardAgreement()) return
          openWalletSheet(wallet)
        }}
      />
    )
  }

  // Same claim rule as the MoreWallets grid: announced, or — without a WC
  // handoff — a configured connector (e.g. a vendor SDK) that claims the
  // wallet.
  const claimed = announced ?? connectors.find((c) => matchesWallet(c, wallet))

  if (!claimed) return <WalletDownloadRow wallet={wallet} />

  // Hand off to the `wallet-connecting` step, which owns the connect() call.
  const handleClick = () => {
    if (authPending) return
    if (!guardAgreement()) return
    startWalletConnection({
      connectorUid: claimed.uid,
      name: wallet.name,
      icon: wallet.icon,
    })
  }

  return (
    <ListItem
      {...shared}
      {...(!!announced && { subtitle: <Badge text="INSTALLED" /> })}
      disabled={authPending}
      onClick={handleClick}
    />
  )
}

/**
 * The row with a Solana namespace. The wallet's Wallet Standard registration
 * is matched by the guide name (MetaMask registers as "MetaMask", Phantom as
 * "Phantom"). Without one the row is the EVM row, or the download link when
 * the host left EVM out (`withEvm`); with one and an announced EVM provider
 * it opens the chain choice; with one alone it connects Solana directly — an
 * installed wallet beats a pairing handoff, as on the EVM side.
 */
function SignUpWalletMultichain({
  wallet,
  withEvm,
}: {
  wallet: WalletGuideEntry
  /** Whether `'eip155'` is among the row's namespaces: the EVM side joins
   * the chain choice, and stands in when there is no Solana registration. */
  withEvm: boolean
}) {
  const { startWalletConnection } = useAuth()
  const { authPending, guardAgreement } = useSignUpContext()
  const connectors = useConnectors()
  const connections = useConnections()
  const solanaWallets = useSolanaWallets()
  // A reload that lands on a sheet offering Solana restores the last Solana
  // wallet; a sheet without a Solana unit restores nothing.
  useSolanaAutoReconnect()
  const { connectSolana, pendingSolanaName, connectedSolanaName } =
    useSolanaConnect()
  const [choosing, setChoosing] = useState(false)

  const solana = solanaWallets.find((w) =>
    equalsIgnoreCase(w.name, wallet.name),
  )
  if (!solana) {
    return withEvm ? (
      <SignUpWalletEvm wallet={wallet} />
    ) : (
      <WalletDownloadRow wallet={wallet} />
    )
  }

  // Only an announced EVM provider joins the Solana side in the choice: a
  // configured SDK connector or the pairing sheet is not "installed". A
  // host that left EVM out of the namespaces gets no EVM side at all.
  const announced = withEvm
    ? connectors.find((c) => announcesWallet(c, wallet))
    : undefined
  const isEvmConnected =
    !!announced && connections.some((c) => c.connector.uid === announced.uid)
  const isSolanaConnected = connectedSolanaName === solana.name
  const isSolanaPending = pendingSolanaName === solana.name
  const isConnectable = (!!announced && !isEvmConnected) || !isSolanaConnected

  const connectEvm = () => {
    if (!announced || isEvmConnected || authPending) return
    if (!guardAgreement()) return
    setChoosing(false)
    startWalletConnection({
      connectorUid: announced.uid,
      name: wallet.name,
      icon: wallet.icon,
    })
  }

  const connectSol = () => {
    if (isSolanaConnected) return
    setChoosing(false)
    // Settles through the shared hook (error takeover or closed flow).
    connectSolana(solana)
  }

  const onRowClick = () => {
    if (authPending || !isConnectable) return
    if (announced) {
      setChoosing((current) => !current)
      return
    }
    connectSol()
  }

  return (
    <div className="zd:flex zd:flex-col zd:gap-2">
      <ListItem
        title={wallet.name}
        icon={<img src={wallet.icon} alt="" className="zd:w-6 zd:h-6" />}
        subtitle={
          <MultichainBadges
            evm={!!announced}
            solana
            state={
              isEvmConnected || isSolanaConnected
                ? 'CONNECTED'
                : isSolanaPending
                  ? 'CONNECTING'
                  : 'INSTALLED'
            }
          />
        }
        trailing={<ListItemChevron />}
        disabled={authPending || !isConnectable}
        onClick={onRowClick}
      />
      {choosing && !!announced && (
        <ChainChoice
          name={wallet.name}
          evmDisabled={authPending || isEvmConnected}
          solanaDisabled={authPending || isSolanaConnected}
          onEvm={connectEvm}
          onSolana={connectSol}
        />
      )}
    </div>
  )
}
