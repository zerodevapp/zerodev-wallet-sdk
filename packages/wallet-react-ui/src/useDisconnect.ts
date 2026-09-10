import type { Connector } from 'wagmi'
import { useConfig, useDisconnect as useWagmiDisconnect } from 'wagmi'

/** The slice of an EIP-1193 provider this hook patches. */
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
}

/**
 * Per-provider patch bookkeeping, reference-counted across overlapping
 * disconnects. An unconditional install/restore pair would break under
 * concurrency: the first disconnect to finish would restore the real
 * `request` while a second is still running (its revoke then reaches the
 * wallet — the exact prompt this hook suppresses), and the second's restore
 * would reinstall the first's wrapper permanently.
 */
const patches = new WeakMap<
  Eip1193Provider,
  { original: Eip1193Provider['request']; count: number }
>()

/** Install the revoke-suppressing wrapper; returns the paired release. */
function acquirePatch(provider: Eip1193Provider): () => void {
  let entry = patches.get(provider)
  if (!entry) {
    // The exact original function, not a bound copy: release() puts this
    // back, and integrations that compare, wrap, or restore `request`
    // themselves must see the provider exactly as it was.
    const original = provider.request
    provider.request = (args) =>
      args?.method === 'wallet_revokePermissions'
        ? Promise.resolve(null)
        : original.call(provider, args)
    entry = { original, count: 0 }
    patches.set(provider, entry)
  }
  entry.count++
  let released = false
  return () => {
    if (released) return
    released = true
    entry.count--
    if (entry.count === 0) {
      provider.request = entry.original
      patches.delete(provider)
    }
  }
}

/**
 * wagmi's `useDisconnect`, guaranteed to never surface a wallet prompt.
 *
 * wagmi's injected connector sends `wallet_revokePermissions` on disconnect.
 * If the wallet still holds an unanswered connection request for this origin
 * (the user ignored a prompt and reloaded — pending confirmations live in the
 * extension and survive reloads), that request sits dormant while the origin
 * is permitted; revoking re-arms it, and the wallet pops its connect view the
 * moment the user logs out. EIP-1193 has no way to inspect or clear a
 * wallet's queue, so the only page-side guarantee is to not touch wallet
 * permissions at all: disconnect stays app-side (wagmi state + reconnect
 * shim), and the site remains authorized in the wallet until the user revokes
 * it there — the norm before wagmi 2.10 added the revoke.
 */
type WagmiDisconnect = ReturnType<typeof useWagmiDisconnect>

export function useDisconnect(): WagmiDisconnect {
  const { disconnect: _drop, disconnectAsync, ...rest } = useWagmiDisconnect()
  const config = useConfig()

  const currentConnector = (): Connector | undefined => {
    const current = config.state.current
    return current
      ? config.state.connections.get(current)?.connector
      : undefined
  }

  // Same signature as wagmi's, including the per-call mutation options
  // (`disconnect(vars, { onSuccess, onError })`), which are forwarded as-is —
  // this is a drop-in replacement, so it must not narrow the public surface.
  const disconnectAsyncQuietly: WagmiDisconnect['disconnectAsync'] = async (
    ...args
  ) => {
    const [variables] = args
    const connector = variables?.connector ?? currentConnector()
    const provider = (await connector?.getProvider().catch(() => undefined)) as
      | Eip1193Provider
      | undefined

    if (!provider?.request) return disconnectAsync(...args)

    const release = acquirePatch(provider)
    try {
      return await disconnectAsync(...args)
    } finally {
      release()
    }
  }

  const disconnectQuietly: WagmiDisconnect['disconnect'] = (...args) => {
    disconnectAsyncQuietly(...args).catch(() => {
      // wagmi surfaces the failure through the mutation state in `rest`.
    })
  }

  return {
    ...rest,
    disconnect: disconnectQuietly,
    disconnectAsync: disconnectAsyncQuietly,
  }
}
