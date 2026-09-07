import {
  BottomSheet,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTitle,
  Button,
  QrCode,
  Text,
} from '@zerodev/react-ui'
import { useState } from 'react'
import { useConnect, useConnectors } from 'wagmi'
import { walletConnectLogo } from '../../brandAssets'
import { useAuth } from '../../hooks/useAuth'
import type { WalletConnectPairing } from '../../hooks/useWalletConnectPairing'
import { isCancellationError } from '../../utils/isCancellationError'
import { matchesWallet, type WalletGuideEntry } from '../../walletGuide'

export type WalletSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Absent = generic WalletConnect mode (raw-URI QR, no tabs). */
  wallet?: WalletGuideEntry | undefined
  /** Page-level pairing (preloaded by the SignUp root) shared by every wallet
   * surface. */
  pairing: WalletConnectPairing
}

/**
 * Bottom sheet with the connection paths for one wallet (or the generic
 * WalletConnect pairing). The pairing is preloaded at page level so the QR is
 * ready on open and mobile row taps can deep-link synchronously; when the
 * proposal expires, WalletConnect rejects the pending connect and the error
 * branch offers Try again.
 */
export function WalletSheet({
  open,
  onOpenChange,
  wallet,
  pairing,
}: WalletSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="zd:p-4">
        <BottomSheetTitle>
          {wallet ? `Connect ${wallet.name}` : 'WalletConnect'}
        </BottomSheetTitle>
        <SheetBody wallet={wallet} pairing={pairing} />
      </BottomSheetContent>
    </BottomSheet>
  )
}

function SheetBody({
  wallet,
  pairing,
}: {
  wallet?: WalletGuideEntry | undefined
  pairing: WalletConnectPairing
}) {
  const { goToStep } = useAuth()
  const { uri, error, retry } = pairing
  const connectors = useConnectors()
  const { connect } = useConnect()

  // Installed (announced/configured) connector for the selected wallet —
  // drives the Browser tab: connect directly instead of "get the extension".
  const installed = wallet
    ? connectors.find((c) => matchesWallet(c, wallet))
    : undefined
  const [tab, setTab] = useState<'mobile' | 'browser'>(
    installed ? 'browser' : 'mobile',
  )
  const [connectError, setConnectError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Wallet-specific QR encodes the wallet's own deep link so phone cameras
  // route to THAT app (`wc:` is claimed by every wallet app). Generic mode
  // keeps the raw URI so any wallet's in-app scanner can claim the pairing.
  const qrValue =
    uri && wallet?.mobileLink
      ? `${wallet.mobileLink}${encodeURIComponent(uri)}`
      : uri

  const copyUri = async () => {
    if (!uri) return
    // Clipboard access throws in insecure contexts (non-HTTPS) or when the
    // user denies it — don't let that surface as an unhandled rejection.
    try {
      await navigator.clipboard.writeText(uri)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard — the QR / deep link remain the primary paths.
    }
  }

  const connectInstalled = () => {
    if (!installed) return
    setConnectError(null)
    connect(
      { connector: installed },
      {
        onSuccess: () => goToStep(null),
        onError: (err) => {
          if (!isCancellationError(err)) {
            setConnectError(err instanceof Error ? err.message : String(err))
          }
        },
      },
    )
  }

  const shownError = error ?? connectError

  return (
    <div className="zd:flex zd:flex-col zd:items-center zd:gap-3">
      <div className="zd:flex zd:w-full zd:items-center zd:gap-2">
        <img
          src={wallet ? wallet.icon : walletConnectLogo}
          alt=""
          className="zd:w-8 zd:h-8 zd:rounded-xl"
        />
        <Text className="zd:text-h3 zd:flex-1">
          {wallet ? wallet.name : 'WalletConnect'}
        </Text>
        <BottomSheetClose asChild>
          <button
            type="button"
            aria-label="Close"
            className="zd:cursor-pointer zd:px-2 zd:text-greyScale/60"
          >
            ✕
          </button>
        </BottomSheetClose>
      </div>

      {wallet && (
        <div className="zd:flex zd:w-full zd:gap-2">
          {(['mobile', 'browser'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`zd:flex-1 zd:rounded-2xl zd:py-1.5 zd:text-body3 zd:cursor-pointer ${
                tab === t
                  ? 'zd:bg-greyScale/10 zd:font-semibold'
                  : 'zd:text-greyScale/60'
              }`}
            >
              {t === 'mobile' ? 'Mobile' : 'Browser'}
            </button>
          ))}
        </div>
      )}

      {!wallet || tab === 'mobile' ? (
        shownError ? (
          <div className="zd:flex zd:flex-col zd:gap-2 zd:items-center">
            <Text className="zd:text-center zd:text-red-500">{shownError}</Text>
            <Button action="secondary" text="Try again" onClick={retry} />
          </div>
        ) : (
          <>
            <div className="zd:bg-white zd:rounded-2xl zd:p-2 zd:border zd:border-greyScale/10">
              {qrValue ? (
                <QrCode value={qrValue} size={176} />
              ) : (
                <div className="zd:w-[176px] zd:h-[176px] zd:flex zd:items-center zd:justify-center">
                  <div className="zd:w-8 zd:h-8 zd:border-2 zd:border-solarOrange zd:border-t-transparent zd:rounded-full zd:animate-spin" />
                </div>
              )}
            </div>
            {qrValue && wallet?.mobileLink && (
              <a
                href={qrValue}
                className="zd:w-full zd:rounded-2xl zd:bg-greyScale/10 zd:py-2 zd:text-center zd:text-body2 zd:font-semibold"
              >
                Open in {wallet.name}
              </a>
            )}
            <Button
              action="secondary"
              text={copied ? 'Copied' : 'Copy link'}
              onClick={copyUri}
              disabled={!qrValue}
            />
          </>
        )
      ) : shownError ? (
        <div className="zd:flex zd:flex-col zd:gap-2 zd:items-center">
          <Text className="zd:text-center zd:text-red-500">{shownError}</Text>
          <Button
            action="secondary"
            text="Try again"
            onClick={installed ? connectInstalled : retry}
          />
        </div>
      ) : installed && wallet ? (
        <button
          type="button"
          onClick={connectInstalled}
          className="zd:w-full zd:cursor-pointer zd:rounded-2xl zd:bg-greyScale/10 zd:py-2 zd:text-center zd:text-body2 zd:font-semibold"
        >
          Open in {wallet.name}
        </button>
      ) : (
        wallet && (
          <a
            href={wallet.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="zd:w-full zd:rounded-2xl zd:bg-greyScale/10 zd:py-2 zd:text-center zd:text-body2 zd:font-semibold"
          >
            Get {wallet.name}
          </a>
        )
      )}
    </div>
  )
}
