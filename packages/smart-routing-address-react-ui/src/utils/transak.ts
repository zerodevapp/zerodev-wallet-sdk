import {
  arbitrum,
  base,
  bsc,
  linea,
  mainnet,
  optimism,
  polygon,
  scroll,
} from 'viem/chains'

/** Transak widget hosts per environment (docs.transak.com). */
const TRANSAK_HOSTS = {
  PRODUCTION: 'https://global.transak.com',
  STAGING: 'https://global-stg.transak.com',
} as const

/**
 * Chain id → Transak `network` query-param slug, for the chains both SRA
 * and Transak support. Chains missing here simply omit the param, so
 * Transak falls back to its own network picker instead of erroring on an
 * unknown slug.
 */
export const TRANSAK_NETWORKS: Record<number, string> = {
  [mainnet.id]: 'ethereum',
  [arbitrum.id]: 'arbitrum',
  [base.id]: 'base',
  [optimism.id]: 'optimism',
  [polygon.id]: 'polygon',
  [bsc.id]: 'bsc',
  [linea.id]: 'linea',
  [scroll.id]: 'scroll',
}

export type TransakUrlParams = {
  /** Transak partner API key */
  apiKey: string
  /** Defaults to `PRODUCTION` */
  environment?: 'STAGING' | 'PRODUCTION' | undefined
  /** Address purchases are delivered to (the SRA deposit address). Locks
   * Transak's wallet-address form so users can't misroute the buy. */
  walletAddress?: string | undefined
  /** Crypto symbol to preselect (e.g. "USDC") */
  cryptoCurrencyCode?: string | undefined
  /** Chain id to preselect; mapped via `TRANSAK_NETWORKS` */
  chainId?: number | undefined
}

/** Build the Transak on-ramp widget URL, pre-filled with the SRA route. */
export function buildTransakUrl({
  apiKey,
  environment,
  walletAddress,
  cryptoCurrencyCode,
  chainId,
}: TransakUrlParams): string {
  const url = new URL(TRANSAK_HOSTS[environment ?? 'PRODUCTION'])
  url.searchParams.set('apiKey', apiKey)
  if (walletAddress) {
    url.searchParams.set('walletAddress', walletAddress)
    url.searchParams.set('disableWalletAddressForm', 'true')
  }
  if (cryptoCurrencyCode) {
    url.searchParams.set('cryptoCurrencyCode', cryptoCurrencyCode)
  }
  const network = chainId !== undefined ? TRANSAK_NETWORKS[chainId] : undefined
  if (network) url.searchParams.set('network', network)
  return url.toString()
}
