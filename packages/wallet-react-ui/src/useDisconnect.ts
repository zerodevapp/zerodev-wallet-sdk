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
  {
    original: Eip1193Provider['request']
    /** Own-property descriptor of `request` before the patch; undefined if inherited. */
    ownDescriptor: PropertyDescriptor | undefined
    count: number
  }
>()

/**
 * Install the revoke-suppressing wrapper; returns the paired release, or
 * `undefined` when this provider cannot be patched (frozen object,
 * non-configurable or getter-only `request`, a Proxy that swallows defines).
 * EIP-1193 does not require `request` to be writable, and a failed patch
 * must never block the disconnect itself — the caller falls back to a plain
 * disconnect, prompt risk and all.
 */
function acquirePatch(provider: Eip1193Provider): (() => void) | undefined {
  let entry = patches.get(provider)
  if (!entry) {
    // The exact original function, not a bound copy: release() puts this
    // back, and integrations that compare, wrap, or restore `request`
    // themselves must see the provider exactly as it was.
    const original = provider.request
    // Remember the property's *shape* too. EIP-1193 providers commonly define
    // `request` on the prototype (MetaMask's does); the assignment below then
    // creates an own property, and restoring by assignment would leave that
    // shadow behind — pinning the provider to the old method if its prototype
    // later changes. Restored with the recorded descriptor, or deleted.
    const ownDescriptor = Object.getOwnPropertyDescriptor(provider, 'request')
    const wrapper: Eip1193Provider['request'] = (args) =>
      args?.method === 'wallet_revokePermissions'
        ? Promise.resolve(null)
        : original.call(provider, args)
    // defineProperty rather than assignment: assignment throws in strict mode
    // on a frozen provider or a getter-only `request`, and defineProperty
    // also handles the getter case. Configurable, so release can always undo
    // it. If even that fails, or a Proxy quietly ignored it, report
    // unpatchable instead of throwing.
    try {
      Object.defineProperty(provider, 'request', {
        value: wrapper,
        writable: true,
        configurable: true,
        enumerable: ownDescriptor?.enumerable ?? true,
      })
    } catch {
      return undefined
    }
    if (provider.request !== wrapper) return undefined
    entry = { original, ownDescriptor, count: 0 }
    patches.set(provider, entry)
  }
  entry.count++
  let released = false
  return () => {
    if (released) return
    released = true
    entry.count--
    if (entry.count === 0) {
      if (entry.ownDescriptor) {
        Object.defineProperty(provider, 'request', entry.ownDescriptor)
      } else {
        delete (provider as Partial<Eip1193Provider>).request
      }
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
type WagmiDisconnectParameters = Parameters<typeof useWagmiDisconnect>[0]

export function useDisconnect(
  parameters: WagmiDisconnectParameters = {},
): WagmiDisconnect {
  // Same parameters as wagmi's, handed to both hooks: `mutation` options
  // reach wagmi, and a custom `config` is the one we read connectors from —
  // otherwise we would patch a provider from a different config than the one
  // being disconnected.
  const {
    disconnect: _drop,
    disconnectAsync,
    ...rest
  } = useWagmiDisconnect(parameters)
  const config = useConfig(parameters)

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
    variables,
    options,
  ) => {
    // Resolve the connector once and pin it. Without an explicit connector
    // wagmi would resolve `current` again inside disconnectAsync — after the
    // getProvider() await below — and a late wallet approval landing in that
    // gap would move `current`: we'd have patched the old provider while
    // wagmi disconnects the new connector, whose revoke reaches the wallet.
    const connector = variables?.connector ?? currentConnector()
    const pinned = connector ? { ...variables, connector } : variables
    const provider = (await connector?.getProvider().catch(() => undefined)) as
      | Eip1193Provider
      | undefined

    if (!provider?.request) return disconnectAsync(pinned, options)

    // Unpatchable provider: disconnect anyway. Logging out must not be the
    // thing that fails; the worst case is the prompt this hook usually hides.
    const release = acquirePatch(provider)
    if (!release) return disconnectAsync(pinned, options)
    try {
      return await disconnectAsync(pinned, options)
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
