import type { Connector } from 'wagmi'
import { useConfig, useDisconnect as useWagmiDisconnect } from 'wagmi'

/** The slice of an EIP-1193 provider this hook patches. */
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>
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
export function useDisconnect() {
  const { disconnect: _drop, disconnectAsync, ...rest } = useWagmiDisconnect()
  const config = useConfig()

  const currentConnector = (): Connector | undefined => {
    const current = config.state.current
    return current
      ? config.state.connections.get(current)?.connector
      : undefined
  }

  const disconnectAsyncQuietly = async (variables?: {
    connector?: Connector
  }) => {
    const connector = variables?.connector ?? currentConnector()
    const provider = (await connector?.getProvider().catch(() => undefined)) as
      | Eip1193Provider
      | undefined

    if (!provider?.request) return disconnectAsync(variables)

    const original = provider.request.bind(provider)
    provider.request = (args) =>
      args?.method === 'wallet_revokePermissions'
        ? Promise.resolve(null)
        : original(args)
    try {
      return await disconnectAsync(variables)
    } finally {
      provider.request = original
    }
  }

  return {
    ...rest,
    disconnect: (variables?: { connector?: Connector }) => {
      disconnectAsyncQuietly(variables).catch(() => {
        // wagmi surfaces the failure through the mutation state in `rest`.
      })
    },
    disconnectAsync: disconnectAsyncQuietly,
  }
}
