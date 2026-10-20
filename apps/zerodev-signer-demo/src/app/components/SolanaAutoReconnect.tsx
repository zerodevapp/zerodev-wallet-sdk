'use client'

import { useSolanaAutoReconnect } from '@zerodev/wallet-react-ui'

/**
 * `useSolanaAutoReconnect` as an element, so a page can mount it behind
 * `SOLANA_ENABLED` without a conditional hook call. Renders nothing.
 */
export function SolanaAutoReconnect() {
  useSolanaAutoReconnect()
  return null
}
