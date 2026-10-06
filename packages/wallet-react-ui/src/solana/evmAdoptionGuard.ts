import type { Config } from 'wagmi'

const sameWallet = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/** How long after the Solana connect settles to keep watching for a late
 * adoption (the wallet's EVM provider emits its accounts asynchronously). */
const GRACE_MS = 1500

/**
 * Drop a connection from wagmi's state without calling the connector's
 * `disconnect()`: wagmi's own disconnect sends the wallet a permission revoke
 * (`wallet_revokePermissions`), and MetaMask answers that by revoking the
 * whole site, which also ends the Solana connection it shares with the EVM
 * side. Mirrors the rest of wagmi's disconnect action, except the
 * self-connect listener is not restored, so an account switch in the wallet
 * cannot re-adopt the EVM side on its own.
 */
function detachFromWagmiState(config: Config, uid: string): void {
  const connection = config.state.connections.get(uid)
  if (!connection) return
  const { connector } = connection
  const { events } = config._internal
  connector.emitter.off('change', events.change)
  connector.emitter.off('disconnect', events.disconnect)
  config.setState((x) => {
    const connections = new Map(x.connections)
    connections.delete(uid)
    if (connections.size === 0) {
      return { ...x, connections, current: null, status: 'disconnected' }
    }
    const current =
      x.current === uid ? (connections.keys().next().value ?? null) : x.current
    return { ...x, connections, current }
  })
}

/**
 * Disconnect the EVM side of a wallet that also serves the Solana slot,
 * keeping the Solana connection. The wallet's site permission is left alone
 * (see `detachFromWagmiState`); wagmi's disconnect shim is set so a reload
 * does not silently reconnect the EVM side, and the "recent connector"
 * pointer is moved off it like wagmi's own disconnect does. For a wallet
 * that does not share the Solana connection, wagmi's `disconnect` is the
 * right call.
 */
export async function detachEvmConnection(
  config: Config,
  uid: string,
): Promise<void> {
  const connection = config.state.connections.get(uid)
  if (!connection) return
  const { connector } = connection
  detachFromWagmiState(config, uid)
  await config.storage?.setItem(`${connector.id}.disconnected`, true)
  const recent = await config.storage?.getItem('recentConnectorId')
  if (recent === connector.id) {
    const next = config.state.current
      ? config.state.connections.get(config.state.current)?.connector.id
      : undefined
    if (next) await config.storage?.setItem('recentConnectorId', next)
    else await config.storage?.removeItem('recentConnectorId')
  }
}

/**
 * Run a Solana `connect` without wagmi adopting the EVM side of the same
 * wallet.
 *
 * Multichain wallets (MetaMask, Phantom) authorise a site for every namespace
 * in one prompt, and wagmi's injected connectors adopt a wallet that
 * "connects itself" (its provider announces accounts while wagmi is
 * disconnected). Choosing Solana in MetaMask would therefore light up the EVM
 * side too. This detaches any such adoption that appears while `run` is in
 * flight, and for a short grace period after, at wagmi's state level only:
 * the wallet's own permission is left alone, because MetaMask revokes the
 * whole site connection (Solana included) on `wallet_revokePermissions`.
 * Afterwards that connector no longer listens for self-connects; an explicit
 * EVM connect through it still works and needs no new prompt.
 */
export async function withoutEvmAdoption<T>(
  config: Config,
  walletName: string,
  run: () => Promise<T>,
): Promise<T> {
  const before = new Set(config.state.connections.keys())

  const detach = (uid: string) => {
    const connection = config.state.connections.get(uid)
    if (!connection) return
    if (!sameWallet(connection.connector.name, walletName)) return
    detachFromWagmiState(config, uid)
  }

  let sweeping = false
  const sweep = () => {
    if (sweeping) return
    sweeping = true
    try {
      for (const uid of config.state.connections.keys()) {
        if (!before.has(uid)) detach(uid)
      }
    } finally {
      sweeping = false
    }
  }

  const unsubscribe = config.subscribe((s) => s.connections, sweep)
  try {
    return await run()
  } finally {
    sweep()
    setTimeout(() => {
      sweep()
      unsubscribe()
    }, GRACE_MS)
  }
}
