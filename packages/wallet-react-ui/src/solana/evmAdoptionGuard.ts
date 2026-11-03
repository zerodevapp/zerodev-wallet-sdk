import type { Config, Connection } from 'wagmi'
import { equalsIgnoreCase } from '../shared/utils/common'

/** How long after the Solana connect settles to keep watching for a late
 * adoption (the wallet's EVM provider emits its accounts asynchronously). */
const GRACE_MS = 1500

/** How long to wait for wagmi's reload reconnect to begin before taking the
 * page to have none: the host's provider has `reconnectOnMount` off, or it
 * ran to the end before the guard mounted. It otherwise begins within
 * microtasks of wagmi's mount. */
const RECONNECT_START_MS = 1000

/** Connector uids the host is connecting on purpose right now. */
const explicitEvmConnections = new Set<string>()

/**
 * Declare an explicit EVM connect through `connector`, so an adoption guard
 * running for the same wallet (a Solana connect in flight, or settled within
 * its grace period) does not mistake the connection for a self-connect and
 * detach it. Call `release()` once the connect has settled. A guard that is
 * watching when the connection lands records it as the host's for the rest
 * of its lifetime, and a guard that starts later sees it as pre-existing,
 * so the exemption need not outlive the connect.
 */
export function allowEvmConnection(connector: { uid: string }): () => void {
  explicitEvmConnections.add(connector.uid)
  return () => {
    explicitEvmConnections.delete(connector.uid)
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
  const ids = new Set(dormantEvmConnectors(config, walletName).map((c) => c.id))
  // Under `ssr`, wagmi turns the announced EIP-6963 providers into connectors
  // only in its mount effect, right before its reconnect sweep: at mount the
  // connector may not exist yet, but its id (the rdns) is known, and the
  // shim is keyed on it.
  for (const { info } of config._internal.mipd?.getProviders() ?? []) {
    if (equalsIgnoreCase(info.name, walletName)) ids.add(info.rdns)
  }
  for (const id of ids) {
    await config.storage?.setItem(`${id}.disconnected`, true)
  }
}

/**
 * Take wagmi's self-connect listener off the dormant EVM connectors of
 * `walletName`. A reload re-arms it on every injected connector, and the
 * connector's `accountsChanged` handler adopts the wallet as long as the
 * listener is there (and deletes the `disconnected` shim as it does). With it
 * gone the handler emits a plain `change` instead, which wagmi ignores for a
 * connector it holds no connection for. An explicit EVM connect does not
 * need the listener: wagmi's connect action attaches its own.
 */
export function muteDormantEvmSide(config: Config, walletName: string): void {
  for (const connector of dormantEvmConnectors(config, walletName)) {
    connector.emitter.off('connect', config._internal.events.connect)
  }
}

const hasWallet = (
  connections: Iterable<Pick<Connection, 'connector'>>,
  walletName: string,
) =>
  [...connections].some((c) => equalsIgnoreCase(c.connector.name, walletName))

/**
 * Whether `walletName` was connected on the EVM side when the page loaded,
 * per the connections wagmi persisted: those are the ones held on purpose
 * (an adoption the guard detached is gone from them, and so is anything
 * disconnected). `restored` is that map read off the config at the first
 * render, where wagmi rehydrates it before rendering; under `ssr` it reads
 * storage in its mount effect instead, so pass null and the record is read
 * here, ahead of the sweep that could add to it.
 */
async function wasConnectedAtLoad(
  config: Config,
  walletName: string,
  restored: Config['state']['connections'] | null,
): Promise<boolean> {
  if (restored) return hasWallet(restored.values(), walletName)
  // The persisted record sits under wagmi's `store` key, which its storage
  // type does not list.
  const storage = config.storage as {
    getItem(key: string): unknown
  } | null
  const persisted = (await storage?.getItem('store')) as {
    state?: { connections?: unknown }
  } | null
  const connections = persisted?.state?.connections
  return connections instanceof Map
    ? hasWallet(connections.values(), walletName)
    : false
}

/**
 * Run `fn` once wagmi's reload reconnect has settled: it reports
 * `connecting` or `reconnecting` while sweeping the connectors and a settled
 * status after. A page with no sweep (the host turned `reconnectOnMount`
 * off, or it ended before this mounted) runs `fn` after a short wait.
 */
function afterReconnectSettles(config: Config, fn: () => void): () => void {
  const isSettled = (status: Config['state']['status']) =>
    status === 'connected' || status === 'disconnected'
  let sweeping = !isSettled(config.state.status)
  const stop = () => {
    unsubscribe()
    clearTimeout(timer)
  }
  const unsubscribe = config.subscribe(
    (s) => s.status,
    (status) => {
      if (!isSettled(status)) {
        sweeping = true
        return
      }
      if (!sweeping) return
      stop()
      fn()
    },
  )
  const timer = setTimeout(() => {
    if (sweeping) return
    stop()
    fn()
  }, RECONNECT_START_MS)
  return stop
}

/**
 * Keep the EVM side of `walletName`, a multichain wallet whose Solana
 * session is being restored after a reload, from coming back on its own.
 * Mount with the saved Solana wallet's name; returns the cleanup.
 *
 * The wallet granted its EVM accounts alongside Solana in one prompt, so
 * after a reload wagmi's reconnect sweep finds its injected connector
 * authorised, and the wallet announcing its accounts would be adopted as a
 * self-connect. The `disconnected` shim keeps the sweep off, but it is not
 * to be relied on: the connector's own `accountsChanged` handler deletes it
 * whenever the wallet announces accounts while nothing is connected, which
 * a multichain wallet does around the Solana connect itself. So, when the
 * wallet was not connected on the EVM side at load (`wasConnectedAtLoad`,
 * the host's own connections are never touched): write the shim again,
 * ahead of the sweep where the ordering allows; take the self-connect
 * listener off; and once the sweep has settled, detach what it adopted all
 * the same, at wagmi's state level (the wallet's permission is left alone,
 * see `detachFromWagmiState`). A connection the host asks for meanwhile is
 * declared through `allowEvmConnection` and kept.
 */
export function guardDormantEvmSide(
  config: Config,
  walletName: string,
  restored: Config['state']['connections'] | null,
): () => void {
  let stopped = false
  let stopWatch: (() => void) | undefined
  const guard = async () => {
    if (await wasConnectedAtLoad(config, walletName, restored)) return
    if (stopped) return
    muteDormantEvmSide(config, walletName)
    await shimDormantEvmSide(config, walletName)
    if (stopped) return
    stopWatch = afterReconnectSettles(config, () => {
      for (const [uid, connection] of config.state.connections) {
        if (explicitEvmConnections.has(uid)) continue
        if (!equalsIgnoreCase(connection.connector.name, walletName)) continue
        // The state-level drop is synchronous; only the storage writes
        // after it can fail, and a failed shim costs nothing here.
        detachEvmConnection(config, uid).catch(() => {})
      }
    })
  }
  // Best effort: with storage unreadable the guard stands down.
  guard().catch(() => {})
  return () => {
    stopped = true
    stopWatch?.()
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
    // Asked for by the host: not an adoption. Remember it as pre-existing for
    // this guard: the host's connect may settle (and its exemption end) while
    // the Solana prompt is still open, and the sweep after `run` must not
    // read the connection as an adoption then.
    if (explicitEvmConnections.has(uid)) {
      before.add(uid)
      return
    }
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
