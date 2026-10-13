import type UniversalProvider from '@walletconnect/universal-provider'

/** What the kit needs to open a WalletConnect `solana` session: the same
 * project id and app metadata the EVM connector was configured with. */
export type SolanaWalletConnectConfig = {
  projectId: string
  metadata?: UniversalProvider['providerOpts']['metadata'] | undefined
  relayUrl?: string | undefined
}

const providers = new Map<string, Promise<UniversalProvider>>()

/**
 * One `UniversalProvider` per project id, created on first use. The SDK is
 * imported lazily so hosts that never enable Solana over WalletConnect do
 * not load it. It gets its own storage prefix: wagmi's WalletConnect
 * connector runs a sign client of its own, and two clients sharing the
 * default prefix would overwrite each other's sessions.
 */
export function getSolanaWalletConnectProvider(
  config: SolanaWalletConnectConfig,
): Promise<UniversalProvider> {
  let provider = providers.get(config.projectId)
  if (!provider) {
    provider = import('@walletconnect/universal-provider').then(
      ({ UniversalProvider }) =>
        UniversalProvider.init({
          projectId: config.projectId,
          ...(config.metadata && { metadata: config.metadata }),
          ...(config.relayUrl && { relayUrl: config.relayUrl }),
          name: 'zerodev-solana',
          customStoragePrefix: 'zerodev-solana',
        }),
    )
    providers.set(config.projectId, provider)
  }
  return provider
}
