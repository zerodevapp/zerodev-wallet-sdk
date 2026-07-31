'use client'

import { type WalletMode } from '@zerodev/wallet-react'
import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { type Transport, createConfig, http } from 'wagmi'
import type { ResolvedWalletConfig } from './lib/config-params'

// Local testing toggle for the connector's account mode.
// Set NEXT_PUBLIC_WALLET_MODE to 'EOA' | '4337' | '7702' to override; leave
// unset for the SDK default ('7702').
const mode = process.env.NEXT_PUBLIC_WALLET_MODE as WalletMode | undefined

/**
 * Builds a wagmi config from an already-resolved override set.
 *
 * A factory rather than a module-scope `config` because the values now come
 * from the request URL, which module scope can't see. `Providers` calls this
 * once per resolved config so the server and client build the same thing —
 * see `providers.tsx`.
 *
 * Note the cost of ever calling this again with different input: a new config
 * means a new connector, which means the wallet session is gone. That is
 * inherent to wagmi, and it's why changing config is a full page load.
 */
export function createWalletConfig(resolved: ResolvedWalletConfig) {
  const transports = Object.fromEntries(
    resolved.chains.map((chain) => [chain.id, http(resolved.rpcUrls[chain.id])]),
  ) as Record<number, Transport>

  return createConfig({
    chains: resolved.chains,
    connectors: [
      zeroDevWallet({
        projectId: process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID!,
        proxyBaseUrl: resolved.kmsProxyBaseUrl!,
        chains: [...resolved.chains],
        ...(resolved.aaHost && { aaHost: resolved.aaHost }),
        // Local testing override: our docker backend's Turnkey base org differs
        // from the SDK's hardcoded prod default, so point the connector at it.
        ...(process.env.NEXT_PUBLIC_ORG_ID && {
          organizationId: process.env.NEXT_PUBLIC_ORG_ID,
        }),
        ...(mode && { mode }),
      }),
    ],
    ssr: true,
    transports,
  })
}
