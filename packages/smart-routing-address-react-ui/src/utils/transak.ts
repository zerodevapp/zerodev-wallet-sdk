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

/**
 * Chain id → Transak `network` param slug, for the chains both SRA and
 * Transak support. Chains missing here simply omit the param, so Transak
 * falls back to its own network picker instead of erroring on an unknown
 * slug. The widget URL itself is minted server-side by the host (see
 * `SmartRoutingAddressConfig.onramp`); this map only shapes the params the
 * widget hands to that callback.
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
