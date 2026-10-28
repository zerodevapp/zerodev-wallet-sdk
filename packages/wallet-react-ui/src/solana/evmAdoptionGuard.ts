import type { Config } from 'wagmi'
import { equalsIgnoreCase } from '../shared/utils/common'

/** How long after the Solana connect settles to keep watching for a late
 * adoption (the wallet's EVM provider emits its accounts asynchronously). */
const GRACE_MS = 1500

/** Connector uids the host is connecting on purpose right now. */
const explicitEvmConnections = new Set<string>()

/**
 * Declare an explicit EVM connect through `connector`, so an adoption guard
 * running for the same wallet (a Solana connect moments earlier, still in
 * its grace period) does not mistake the connection for a self-connect and
 * detach it. Call `release()` once the connect has settled; the exemption
 * outlives it by the guard's grace period, which is as long as any guard
 * can still be watching.
 */
export function allowEvmConnection(connector: { uid: string }): () => void {
  explicitEvmConnections.add(connector.uid)
  return () => {
    setTimeout(() => explicitEvmConnections.delete(connector.uid), GRACE_MS)
  }
}

/**
 * Drop a connection from wagmi's state without calling the connector's
 * `disconnect()`: wagmi's own disconnect sends the wallet a permission revoke
 * (`wallet_revokePermissions`), and MetaMask answers that by revoking the
 * whole site, which also ends the Solana connection it shares with the EVM
 * side. Mirrors the rest of wagmi's disconnect action, except the
 * self-connect listener is removed rather than restored, so an account switch
 * in the wallet cannot re-adopt the EVM side on its own.
 */
function detachFromWagmiState(config: Config, uid: string): void {
  const connection = config.state.connections.get(uid)
  if (!connection) return
  const { connector } = connection
  const { events } = config._internal
  connector.emitter.off('change', events.change)
  connector.emitter.off('disconnect', events.disconnect)
  // wagmi's adoption handler means to drop this listener but calls `off` with
  // the wrong function, so it survives an adoption; without this an account
  // switch in the wallet would adopt the EVM side all over again.
  connector.emitter.off('connect', events.connect)
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
 * The injected (EIP-6963) connectors wagmi has for `walletName` that hold no
 * connection: the EVM side a multichain wallet authorised alongside Solana,
 * which nothing asked wagmi to use.
 */
function dormantEvmConnectors(config: Config, walletName: string) {
  return config.connectors.filter(
    (c) =>
      c.type === 'injected' &&
      c.id !== 'injected' &&
      c.id !== 'zerodev-wallet' &&
      equalsIgnoreCase(c.name, walletName) &&
      !config.state.connections.has(c.uid),
  )
}

/**
 * Keep wagmi's reload reconnect from adopting the EVM side of `walletName`
 * while nothing is connected through it. wagmi reconnects every connector
 * whose `isAuthorized()` passes, and an injected connector passes as soon as
 * the wallet grants accounts, which a multichain wallet does for EVM in the
 * same prompt as Solana. Its `disconnected` shim is what wagmi checks first.
 */
async function shimDormantEvmSide(
  config: Config,
  walletName: string,
): Promise<void> {
  for (const connector of dormantEvmConnectors(config, walletName)) {
    await config.storage?.setItem(`${connector.id}.disconnected`, true)
  }
}

/**
 * End the EVM side a multichain wallet granted alongside a Solana connection
 * that is now going away, when nothing is connected through it: the wallet's
 * own disconnect (a permission revoke where the wallet supports one, and the
 * `disconnected` shim). A wallet that is connected on the EVM side is left
 * alone; that is an explicit connection with its own disconnect.
 */
export async function revokeDormantEvmSide(
  config: Config,
  walletName: string,
): Promise<void> {
  for (const connector of dormantEvmConnectors(config, walletName)) {
    try {
      await connector.disconnect()
    } catch {
      // No provider to revoke through; the shim alone keeps a reload from
      // adopting the side.
      await config.storage?.setItem(`${connector.id}.disconnected`, true)
    }
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
 * Afterwards that connector no longer listens for self-connects, and carries
 * wagmi's `disconnected` shim so a reload does not adopt the side either; an
 * explicit EVM connect through it still works and needs no new prompt (the
 * kit hook clears the shim first).
 */
export async function withoutEvmAdoption<T>(
  config: Config,
  walletName: string,
  run: () => Promise<T>,
): Promise<T> {
  const before = new Set(config.state.connections.keys())

  const detach = (uid: string) => {
    // Asked for by the host: not an adoption.
    if (explicitEvmConnections.has(uid)) return
    const connection = config.state.connections.get(uid)
    if (!connection) return
    if (!equalsIgnoreCase(connection.connector.name, walletName)) return
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
  let connected = false
  try {
    const result = await run()
    connected = true
    return result
  } finally {
    sweep()
    // Only after a connect: a declined prompt grants nothing to hold back.
    if (connected) await shimDormantEvmSide(config, walletName)
    setTimeout(() => {
      sweep()
      unsubscribe()
    }, GRACE_MS)
  }
}
