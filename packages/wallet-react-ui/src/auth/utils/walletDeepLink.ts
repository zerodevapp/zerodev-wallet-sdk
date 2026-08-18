import { matchesWallet, type WalletGuideEntry } from '../walletGuide'

/** Don't redirect into a link about to expire — the app would open on a dead
 * pairing. Tap falls back to the sheet, which re-pairs. */
const FRESH_MARGIN_MS = 10_000

/**
 * Wrapped deep link for the one-tap mobile redirect into `wallet`'s app, or
 * null when the tap should just open the sheet: desktop, a claiming installed
 * connector (direct connect wins), or a missing/stale pairing URI.
 */
export function walletDeepLink(params: {
  wallet: WalletGuideEntry
  connectors: readonly {
    id: string
    rdns?: string | readonly string[] | undefined
  }[]
  uri: string | null
  expiresAt: number | null
  mobile: boolean
}): string | null {
  const { wallet, connectors, uri, expiresAt, mobile } = params
  if (!wallet.mobileLink || !mobile || !uri) return null
  if (!expiresAt || Date.now() >= expiresAt - FRESH_MARGIN_MS) return null
  if (connectors.some((c) => matchesWallet(c, wallet))) return null
  return `${wallet.mobileLink}${encodeURIComponent(uri)}`
}
