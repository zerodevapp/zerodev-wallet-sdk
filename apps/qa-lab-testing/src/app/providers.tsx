'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { WagmiProvider } from 'wagmi'
import { pickConfigParams, resolveWalletConfig } from './lib/config-params'
import { createWalletConfig } from './wagmi-config'

type WalletConfig = ReturnType<typeof createWalletConfig>

type ConfigEntry = {
  config: WalletConfig
  queryClient: QueryClient
}

/**
 * One wagmi config per set of config params, so Strict Mode's double mount
 * reuses the connector instead of orphaning it.
 */
const clientCache = new Map<string, ConfigEntry>()

/**
 * The config only, on the server. Shareable because it is a pure function of
 * the config params; caching it matters because `createConfig` runs every
 * connector's `setup()`, and `walletConnect.setup()` initialises WalletConnect
 * eagerly with no `typeof window` guard.
 *
 * The QueryClient is **not** cached here: one shared across requests would
 * serve one request's fetched data to the next.
 */
const serverConfigCache = new Map<string, WalletConfig>()

/**
 * `rpc.<chainId>` accepts an arbitrary URL, so the keyspace is unbounded. Cap
 * it and evict oldest-first.
 */
const MAX_SERVER_CONFIGS = 32

function createConfigFor(configKey: string): WalletConfig {
  return createWalletConfig(resolveWalletConfig(new URLSearchParams(configKey)))
}

function getConfigFor(configKey: string): ConfigEntry {
  if (typeof window === 'undefined') {
    let config = serverConfigCache.get(configKey)
    if (!config) {
      config = createConfigFor(configKey)
      if (serverConfigCache.size >= MAX_SERVER_CONFIGS) {
        // Map iterates in insertion order, so this is the oldest entry.
        const oldest = serverConfigCache.keys().next().value
        if (oldest !== undefined) serverConfigCache.delete(oldest)
      }
      serverConfigCache.set(configKey, config)
    }
    return { config, queryClient: new QueryClient() }
  }

  const cached = clientCache.get(configKey)
  if (cached) return cached

  const entry = {
    config: createConfigFor(configKey),
    // Tied to the config: a different connector means a different session, so
    // the previous cache is meaningless.
    queryClient: new QueryClient(),
  }
  clientCache.set(configKey, entry)
  return entry
}

/**
 * Builds the wagmi config from the request's query params.
 *
 * `useSearchParams` rather than reading `window.location` at module scope: the
 * params are part of the request, so with dynamic rendering (forced in the root
 * layout) this hook returns the same values during SSR and on the client. Both
 * passes therefore build an identical config, which is what keeps chain-derived
 * UI from mismatching on hydration.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const configKey = pickConfigParams(searchParams).toString()
  const { config, queryClient } = getConfigFor(configKey)

  return (
    // `key` remounts the provider if config params ever change client-side.
    // Navigation carries config forward (see ConfigLink) so this shouldn't fire
    // in normal use; when it does, remounting is the correct response.
    <WagmiProvider key={configKey} config={config} reconnectOnMount>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
