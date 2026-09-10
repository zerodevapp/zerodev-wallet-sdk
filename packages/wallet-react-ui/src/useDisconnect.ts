import type { Connector } from 'wagmi'
import { useConfig, useDisconnect as useWagmiDisconnect } from 'wagmi'

/** The slice of an EIP-1193 provider this hook patches. */
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
}

/**
 * Per-provider patch, reference-counted: overlapping disconnects must not
 * restore `request` while another is still running.
 */
const patches = new WeakMap<
  Eip1193Provider,
  {
    original: Eip1193Provider['request']
    /** Own descriptor of `request` before patching; undefined if inherited. */
    ownDescriptor: PropertyDescriptor | undefined
    count: number
  }
>()

/**
 * Install the revoke-suppressing wrapper; returns its release, or `undefined`
 * if the provider can't be patched (frozen, non-configurable, Proxy). A
 * failed patch must never block the disconnect itself.
 */
function acquirePatch(provider: Eip1193Provider): (() => void) | undefined {
  let entry = patches.get(provider)
  if (!entry) {
    // The original function itself (not a bound copy) and the own descriptor,
    // so release restores the exact value and shape. `request` usually lives
    // on the prototype (MetaMask); an own shadow must not be left behind.
    const original = provider.request
    const ownDescriptor = Object.getOwnPropertyDescriptor(provider, 'request')
    const wrapper: Eip1193Provider['request'] = (args) =>
      args?.method === 'wallet_revokePermissions'
        ? Promise.resolve(null)
        : original.call(provider, args)
    // defineProperty, not assignment: assignment throws on frozen providers
    // and getter-only `request`. Configurable so release can undo it.
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

type WagmiDisconnect = ReturnType<typeof useWagmiDisconnect>
type WagmiDisconnectParameters = Parameters<typeof useWagmiDisconnect>[0]

/**
 * wagmi's `useDisconnect`, minus the wallet prompt.
 *
 * wagmi's injected connector sends `wallet_revokePermissions` on disconnect.
 * If the wallet still holds an unanswered connection request for this origin
 * (ignored prompt, then reload), revoking re-arms it and the wallet pops up at
 * logout. EIP-1193 can't inspect or clear that queue, so the revoke is
 * suppressed: disconnect stays app-side, and the site stays authorized in the
 * wallet until the user revokes it there (the norm before wagmi 2.10).
 */
export function useDisconnect(
  parameters: WagmiDisconnectParameters = {},
): WagmiDisconnect {
  // Same parameters as wagmi's: `mutation` options reach wagmi, and a custom
  // `config` is the one we read connectors from.
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

  // Same signature as wagmi's; per-call mutation options pass through.
  const disconnectAsyncQuietly: WagmiDisconnect['disconnectAsync'] = async (
    variables,
    options,
  ) => {
    // Pin the connector: wagmi would otherwise re-resolve `current` after the
    // getProvider() await, and a late approval could move it — patching one
    // provider while disconnecting another.
    const connector = variables?.connector ?? currentConnector()
    const pinned = connector ? { ...variables, connector } : variables
    const provider = (await connector?.getProvider().catch(() => undefined)) as
      | Eip1193Provider
      | undefined

    if (!provider?.request) return disconnectAsync(pinned, options)

    // Unpatchable provider: disconnect anyway; logout must not fail.
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
