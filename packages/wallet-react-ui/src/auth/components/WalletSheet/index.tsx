import { Button, Text, walletConnectLogo } from '@zerodev/react-ui'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Connector } from 'wagmi'
import { useScreenOverlayTarget } from '../../../shared/components/Screen'
import {
  CardGlow,
  MultiRadialBackground,
} from '../../../shared/components/Screen/MultiRadialBackground'
import { matchesWallet, type WalletGuideEntry } from '../../walletGuide'
import { QrCode } from '../QrCode'

// Reown's dual check (pointer:coarse OR UA) — CoreHelperUtil.isMobile.
function isMobile() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini/u.test(
      navigator.userAgent,
    )
  )
}

export type WalletSheetTarget = {
  /** Absent = generic WalletConnect mode (plain QR + copy, no tabs). */
  wallet?: WalletGuideEntry
}

/**
 * Bottom sheet with connection details, slid in over the wallet list —
 * selection stays local state, no step navigation. Rendered through the
 * Screen's overlay portal so it spans the inner card edge-to-edge (the card's
 * clip-path rounds the bottom corners). Always mounted so the translate
 * transition animates both directions.
 */
export function WalletSheet({
  target,
  uri,
  error,
  connectors,
  onSelectConnector,
  onRetry,
  onClose,
}: {
  target: WalletSheetTarget | null
  uri: string | null
  error: string | null
  connectors: readonly Connector[]
  onSelectConnector: (connector: Connector) => void
  onRetry: () => void
  onClose: () => void
}) {
  const overlayTarget = useScreenOverlayTarget()
  const wallet = target?.wallet
  const [tab, setTab] = useState<'mobile' | 'browser'>('mobile')
  const [copied, setCopied] = useState(false)

  // Installed (announced/configured) connector for the selected wallet —
  // drives the Browser tab: connect directly instead of "get the extension".
  const installedConnector = wallet
    ? connectors.find((c) => matchesWallet(c, wallet))
    : undefined

  // Wallet-specific QR encodes the wallet's own deep link so phone cameras
  // route to THAT app (`wc:` is claimed by every wallet app — a raw URI opens
  // whichever one the OS picked). Generic mode keeps the raw URI so any
  // wallet's in-app scanner can claim the pairing.
  const qrValue =
    uri && wallet?.mobileLink
      ? `${wallet.mobileLink}${encodeURIComponent(uri)}`
      : uri

  const firedRef = useRef(false)
  useEffect(() => {
    if (!target) {
      firedRef.current = false
      setTab('mobile')
      setCopied(false)
      return
    }
    if (!firedRef.current && wallet?.mobileLink && uri && isMobile()) {
      firedRef.current = true
      window.location.href = `${wallet.mobileLink}${encodeURIComponent(uri)}`
    }
  }, [target, wallet, uri])

  const copyUri = async () => {
    if (!uri) return
    await navigator.clipboard.writeText(uri)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!overlayTarget) return null

  const open = target !== null

  return createPortal(
    <>
      {/* backdrop — z-20 to paint above the card's z-10 content column */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`zd:absolute zd:inset-0 zd:z-20 zd:bg-black/30 zd:transition-opacity zd:duration-300 ${
          open ? 'zd:opacity-100' : 'zd:opacity-0 zd:pointer-events-none'
        }`}
      />

      {/* sheet — same gradient treatment as the Screen card: base fill +
          CardGlow layers behind a z-10 content wrapper (positioned z-0 layers
          would otherwise paint over in-flow content). rounded-t-4xl matches
          the card's 32px radius AND the layers' own rounding, so the base
          fill never peeks out at the corners. */}
      <div
        className={`zd:absolute zd:inset-x-0 zd:bottom-0 zd:z-20 zd:rounded-t-4xl zd:overflow-hidden zd:bg-[#FBF7F2] zd:p-4 zd:transition-transform zd:duration-300 ${
          open ? 'zd:translate-y-0' : 'zd:translate-y-full'
        }`}
      >
        <MultiRadialBackground />
        <CardGlow />
        <div className="zd:relative zd:z-10 zd:flex zd:flex-col zd:gap-3 zd:items-center">
          <div className="zd:flex zd:w-full zd:items-center zd:gap-2">
            <img
              src={wallet ? wallet.icon : walletConnectLogo}
              alt=""
              className="zd:w-8 zd:h-8 zd:rounded-xl"
            />
            <Text className="zd:text-h3 zd:flex-1">
              {wallet ? wallet.name : 'WalletConnect'}
            </Text>
            <button
              type="button"
              onClick={onClose}
              className="zd:cursor-pointer zd:px-2 zd:text-greyScale/60"
            >
              ✕
            </button>
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
            error ? (
              <div className="zd:flex zd:flex-col zd:gap-2 zd:items-center">
                <Text className="zd:text-center zd:text-red-500">{error}</Text>
                <Button action="secondary" text="Try again" onClick={onRetry} />
              </div>
            ) : qrValue ? (
              <>
                <div className="zd:bg-white zd:rounded-2xl zd:p-2 zd:text-black zd:border zd:border-greyScale/10">
                  <QrCode value={qrValue} className="zd:w-44 zd:h-44" />
                </div>
                {wallet?.mobileLink && (
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
                />
              </>
            ) : (
              <Text className="zd:text-center zd:text-greyScale/50">
                Generating connection link…
              </Text>
            )
          ) : installedConnector ? (
            <button
              type="button"
              onClick={() => onSelectConnector(installedConnector)}
              className="zd:w-full zd:cursor-pointer zd:rounded-2xl zd:bg-greyScale/10 zd:py-2 zd:text-center zd:text-body2 zd:font-semibold"
            >
              Open in {wallet.name}
            </button>
          ) : (
            <a
              href={wallet.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="zd:w-full zd:rounded-2xl zd:bg-greyScale/10 zd:py-2 zd:text-center zd:text-body2 zd:font-semibold"
            >
              Get {wallet.name}
            </a>
          )}
        </div>
      </div>
    </>,
    overlayTarget,
  )
}
