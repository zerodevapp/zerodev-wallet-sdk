import { Badge, ListItem, ListItemChevron } from '@zerodev/react-ui'
import { useLayoutEffect } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import { useAuth } from '../../hooks/useAuth'
import { isCancellationError } from '../../utils/isCancellationError'
import { isZeroDevWalletConnect } from '../../utils/isZeroDevWalletConnect'
import {
  announcesWallet,
  matchesWallet,
  WALLET_GUIDE,
  type WalletId,
} from '../../walletGuide'
import { useReportPending, useSignUpContext } from './context'

/** Dedicated row for a single guide wallet: connects it directly when a live
 * connector claims it, and is a download link for the vendor page otherwise. */
export function SignUpWallet({ walletId }: { walletId: WalletId }) {
  const wallet = WALLET_GUIDE.find((w) => w.id === walletId)
  if (!wallet) {
    // Unreachable for TS consumers; catches raw-JS typos.
    throw new Error(
      `Unknown walletId "${walletId}". Valid ids: ${WALLET_GUIDE.map((w) => w.id).join(', ')}`,
    )
  }

  const { goToStep } = useAuth()
  const {
    authPending,
    guardAgreement,
    setError,
    registerWallet,
    openWalletSheet,
  } = useSignUpContext()
  const connectors = useConnectors()
  const { mutate: connect, isPending } = useConnect()
  useReportPending(isPending)
  useLayoutEffect(() => registerWallet(wallet.id), [registerWallet, wallet.id])

  // Same claim rule as the MoreWallets grid: a 6963 announcement or a
  // configured SDK connector both make the row connectable. Only an
  // announcement proves a live extension (or the wallet's own in-app
  // browser) and earns the badge.
  const announced = connectors.find((c) => announcesWallet(c, wallet))
  const installed =
    announced ?? connectors.find((c) => matchesWallet(c, wallet))

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

  if (!installed) {
    return (
      <ListItem {...shared} asChild>
        {/* biome-ignore lint/a11y/useAnchorContent: the row layout (incl. the title text) is injected into the anchor via Slot */}
        <a
          href={wallet.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
        />
      </ListItem>
    )
  }

  const handleClick = () => {
    if (authPending) return
    if (!guardAgreement()) return
    setError(null)
    connect(
      { connector: installed },
      {
        // The external wallet is now the active wagmi connection — the
        // embedded-wallet flow is done, so close it (mirrors SignUp.MoreWallets).
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
    <ListItem
      {...shared}
      {...(!!announced && { subtitle: <Badge text="INSTALLED" /> })}
      disabled={authPending}
      onClick={handleClick}
    />
  )
}
