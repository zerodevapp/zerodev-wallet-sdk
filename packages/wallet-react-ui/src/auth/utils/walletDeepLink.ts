import { matchesWallet, type WalletGuideEntry } from '../walletGuide'

/**
 * Wrapped deep link for the one-tap mobile redirect into `wallet`'s app, or
 * null when the tap should just open the sheet: desktop, a claiming installed
 * connector (direct connect wins), or no pairing URI.
 */
export function walletDeepLink(params: {
  wallet: WalletGuideEntry
  connectors: readonly {
    id: string
    name?: string
    type?: string
    rdns?: string | readonly string[] | undefined
  }[]
  uri: string | null
  mobile: boolean
}): string | null {
  const { wallet, connectors, uri, mobile } = params
  if (!wallet.mobileLink || !mobile || !uri) return null
  if (connectors.some((c) => matchesWallet(c, wallet))) return null
  return `${wallet.mobileLink}${encodeURIComponent(uri)}`
}
