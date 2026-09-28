'use client'

import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { type Transport, createConfig, http } from 'wagmi'
import type { ResolvedWalletConfig } from './lib/config-params'

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
        projectId: resolved.projectId!,
        proxyBaseUrl: resolved.kmsProxyBaseUrl!,
        chains: [...resolved.chains],
        ...(resolved.aaHost && { aaHost: resolved.aaHost }),
        // Local testing override: our docker backend's Turnkey base org differs
        // from the SDK's hardcoded prod default, so point the connector at it.
        ...(process.env.NEXT_PUBLIC_ORG_ID && {
          organizationId: process.env.NEXT_PUBLIC_ORG_ID,
        }),
        // Account mode comes from the resolved config (`?mode=`, then
        // NEXT_PUBLIC_WALLET_MODE, then '7702').
        mode: resolved.mode,
      }),
    ],
    ssr: true,
    transports,
  })
}
