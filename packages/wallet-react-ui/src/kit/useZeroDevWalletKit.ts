import { useMemo } from 'react'
import { useConfig } from 'wagmi'
import { useKitStore } from '../shared/hooks/useKitStore.js'
import { connectEvm, disconnectEvm, useEip155Adapter } from './eip155.js'
import type { AdapterContext } from './shared.js'
import { connectSolana, disconnectSolana, useSolanaAdapter } from './solana.js'
import type {
  KitAdapter,
  KitConnectRequest,
  KitDisconnectParams,
  KitNamespace,
  ZeroDevWalletKit,
  ZeroDevWalletKitOptions,
} from './types.js'

/**
 * The host-facing view of the kit. Every namespace is an adapter with the
 * same members (`status`, `address`, `wallets`, `connect`, `disconnect`, …)
 * and its own implementation behind them (`eip155.ts`, `solana.ts`). Pick
 * one with `namespace`, or omit it for all of them side by side plus the
 * cross-namespace `connect({ namespace, … })` and `disconnect({ namespace? })`.
 *
 * Every adapter's hooks run on every render whichever namespace is picked:
 * the selection is on their results, never on the hook calls.
 *
 * EVM stays wagmi underneath (chains, balances, signing go through wagmi as
 * before); Solana signing goes through `useSolanaWallet()`. Requires the
 * `zeroDevWallet` connector on the wagmi config.
 */
export function useZeroDevWalletKit(
  options?: ZeroDevWalletKitOptions,
): ZeroDevWalletKit
export function useZeroDevWalletKit<NS extends KitNamespace>(
  options: ZeroDevWalletKitOptions & { namespace: NS },
): KitAdapter<NS>
export function useZeroDevWalletKit(
  options: ZeroDevWalletKitOptions & { namespace?: KitNamespace } = {},
): ZeroDevWalletKit | KitAdapter<KitNamespace> {
  const { namespace, reconnectOnMount = true } = options
  const store = useKitStore()
  const config = useConfig()
  const ctx = useMemo(
    (): AdapterContext => ({ store, config }),
    [store, config],
  )

  const eip155 = useEip155Adapter(ctx)
  // An EVM-only view has no Solana session to restore.
  const solana = useSolanaAdapter(ctx, {
    restore: reconnectOnMount && namespace !== 'eip155',
  })

  const kit = useMemo(
    (): ZeroDevWalletKit => ({
      eip155,
      solana,
      isConnected: eip155.isConnected || solana.isConnected,
      isReconnecting: eip155.isReconnecting || solana.isReconnecting,
      connect: (request: KitConnectRequest) =>
        request.namespace === 'solana'
          ? connectSolana(ctx, request)
          : connectEvm(ctx, request),
      disconnect: (params: KitDisconnectParams = {}) =>
        disconnectAll(ctx, params),
    }),
    [eip155, solana, ctx],
  )

  return namespace ? kit[namespace] : kit
}

async function disconnectAll(
  ctx: AdapterContext,
  { namespace }: KitDisconnectParams,
): Promise<void> {
  if (namespace === 'eip155') {
    return disconnectEvm(ctx, ctx.store.getState().solana.connection !== null)
  }
  if (namespace === 'solana') return disconnectSolana(ctx)
  // Both go, so neither needs protecting from the other: a wallet-level
  // revoke that takes Solana down with it is the intended outcome. Each side
  // runs to the end even when the other fails.
  const results = await Promise.allSettled([
    disconnectEvm(ctx, false),
    disconnectSolana(ctx),
  ])
  const failed = results.find(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  )
  if (failed) throw failed.reason
}
