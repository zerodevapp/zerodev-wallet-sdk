import type { Config } from 'wagmi'
import { WALLET_GUIDE } from '../auth/walletGuide'
import { equalsIgnoreCase } from '../shared/utils/common'

/** How long after the Solana connect settles to keep watching for a late
 * adoption (the wallet's EVM provider emits its accounts asynchronously). */
const GRACE_MS = 1500

/** How long to wait for wagmi's reload reconnect to begin before taking the
 * page to have none: the host's provider has `reconnectOnMount` off, or it
 * ran to the end before the guard mounted. It otherwise begins within
 * microtasks of wagmi's mount. */
const RECONNECT_START_MS = 1000

/**
 * One side of a multichain wallet, as the other side needs to recognise it:
 * by its display name. A bare string is the name itself; an object is any
 * registration, connector or saved record that carries one.
 */
export type WalletRef = string | { name: string }

const nameOf = (ref: WalletRef) => (typeof ref === 'string' ? ref : ref.name)

/**
 * Whether `side` (an EIP-6963 connector or announcement, a Wallet Standard
 * wallet, a sheet row) is the same extension as `ref`: the two names match,
 * case-insensitively, because the name is what a wallet calls itself on both
 * registries and the only identity the two registries share (EIP-6963 has an
 * rdns, the Wallet Standard has none). A wallet that spells its name
 * differently on the two sides (ZER-1292) is paired by the wallet guide
 * (`solanaName`), which is how Trust ("Trust Wallet" on EVM, "Trust" on
 * Solana) reads as one; AppKit keys its multichain merge the same way, by
 * name with that one alias.
 */
export function isSameWallet(side: WalletRef, ref: WalletRef): boolean {
  return equalsIgnoreCase(
    canonicalWalletName(nameOf(side)),
    canonicalWalletName(nameOf(ref)),
  )
}

/**
 * The guide's name for a wallet that spells itself differently on its two
 * registries (`solanaName` on the guide entry), so "Trust" and "Trust
 * Wallet" compare equal; any other name is its own key.
 */
function canonicalWalletName(name: string): string {
  const entry = WALLET_GUIDE.find(
    (w) =>
      w.solanaName !== undefined &&
      (equalsIgnoreCase(w.name, name) || equalsIgnoreCase(w.solanaName, name)),
  )
  return entry ? entry.name : name
}

/**
 * Whether `connector` is an installed extension's EVM provider (an EIP-6963
 * announcement, which wagmi surfaces as an injected-type connector with its
 * rdns as id). Only that can share an extension with a Wallet Standard
 * wallet: a WalletConnect session, an SDK connector (`metaMask()`,
 * `coinbaseWallet()`) or the generic `injected()` connector named like one
 * is a separate session with a disconnect of its own.
 */
export function isInstalledEvmConnector(connector: {
  id: string
  type: string
}): boolean {
  return (
    connector.type === 'injected' &&
    connector.id !== 'injected' &&
    connector.id !== 'zerodev-wallet'
  )
}

/** Connector uids the host is connecting on purpose right now. */
const pendingExplicitEvmConnections = new Set<string>()

/**
 * Connector uids the host connected on purpose this page load, per config,
 * for as long as each connection lasts. A guard judges the connections it
 * finds by the load-time record, which knows nothing of what the host did
 * since; this does. An entry goes when its connection does, so a connector
 * the wallet adopts on its own after a disconnect is judged afresh.
 */
const ownedExplicitEvmConnections = new WeakMap<Config, Set<string>>()

function ownedExplicitEvmConnectionsOf(config: Config): Set<string> {
  let owned = ownedExplicitEvmConnections.get(config)
  if (!owned) {
    const set = new Set<string>()
    ownedExplicitEvmConnections.set(config, set)
    // For the page's lifetime, like the config itself.
    config.subscribe(
      (s) => s.connections,
      (connections) => {
        for (const uid of set) if (!connections.has(uid)) set.delete(uid)
      },
    )
    owned = set
  }
  return owned
}

/** Whether `uid` is a connection the host asked for: still connecting, or
 * landed and up since. */
function isExplicitEvmConnection(config: Config, uid: string): boolean {
  return (
    pendingExplicitEvmConnections.has(uid) ||
    (ownedExplicitEvmConnections.get(config)?.has(uid) ?? false)
  )
}

/**
 * Configs whose reload reconnect sweep a guard has judged this page load.
 * The sweep happens once, so a guard mounted after it (a second kit hook
 * in another component, a page component remounting on navigation) has
 * nothing left to catch there, and must not judge the connections the host
 * made since by the load-time record: those are explicit, and sweeping
 * them away would disconnect the user for no reason.
 */
const sweptConfigs = new WeakSet<Config>()

/**
 * Declare an explicit EVM connect through `connector`, so no adoption guard
 * for the same wallet mistakes the connection for a self-connect and
 * detaches it: not one running now (a Solana connect in flight, or settled
 * within its grace period), and not one mounted later on the page (a kit
 * hook the host reaches by navigating after it connected, whose only other
 * record is the load-time one). Call `release()` once the connect has
 * settled; a connection that landed stays declared for as long as it is up.
 */
export function allowEvmConnection(
  config: Config,
  connector: { uid: string },
): () => void {
  const { uid } = connector
  pendingExplicitEvmConnections.add(uid)
  return () => {
    pendingExplicitEvmConnections.delete(uid)
    if (config.state.connections.has(uid)) {
      ownedExplicitEvmConnectionsOf(config).add(uid)
    }
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
 * The injected (EIP-6963) connectors wagmi has for `wallet` that hold no
 * connection: the EVM side a multichain wallet authorised alongside Solana,
 * which nothing asked wagmi to use.
 */
function dormantEvmConnectors(config: Config, wallet: WalletRef) {
  return config.connectors.filter(
    (c) =>
      isInstalledEvmConnector(c) &&
      isSameWallet(c, wallet) &&
      !config.state.connections.has(c.uid),
  )
}

/**
 * Keep wagmi's reload reconnect from adopting the EVM side of `wallet`
 * while nothing is connected through it. wagmi reconnects every connector
 * whose `isAuthorized()` passes, and an injected connector passes as soon as
 * the wallet grants accounts, which a multichain wallet does for EVM in the
 * same prompt as Solana. Its `disconnected` shim is what wagmi checks first.
 */
async function shimDormantEvmSide(
  config: Config,
  wallet: WalletRef,
): Promise<void> {
  const ids = new Set(dormantEvmConnectors(config, wallet).map((c) => c.id))
  // Under `ssr`, wagmi turns the announced EIP-6963 providers into connectors
  // only in its mount effect, right before its reconnect sweep: at mount the
  // connector may not exist yet, but its id (the rdns) is known, and the
  // shim is keyed on it. A provider whose connector holds a connection is
  // the host's own EVM session, not a dormant side: shimming it would make
  // the next reload skip that session.
  const connectedIds = new Set(
    [...config.state.connections.values()].map(({ connector }) => connector.id),
  )
  for (const { info } of config._internal.mipd?.getProviders() ?? []) {
    if (!isSameWallet(info, wallet)) continue
    if (!connectedIds.has(info.rdns)) ids.add(info.rdns)
  }
  for (const id of ids) {
    await config.storage?.setItem(`${id}.disconnected`, true)
  }
}

/**
 * Take wagmi's self-connect listener off the dormant EVM connectors of
 * `wallet`. A reload re-arms it on every injected connector, and the
 * connector's `accountsChanged` handler adopts the wallet as long as the
 * listener is there (and deletes the `disconnected` shim as it does). With it
 * gone the handler emits a plain `change` instead, which wagmi ignores for a
 * connector it holds no connection for. An explicit EVM connect does not
 * need the listener: wagmi's connect action attaches its own.
 */
export function muteDormantEvmSide(config: Config, wallet: WalletRef): void {
  for (const connector of dormantEvmConnectors(config, wallet)) {
    connector.emitter.off('connect', config._internal.events.connect)
  }
}

/** An EVM connection wagmi had persisted when the page loaded. */
export type EvmConnectionAtLoad = { id: string; name: string }

/**
 * The EVM connections wagmi persisted before this page load, or null when
 * there is no record to read (no storage, nothing saved, or an unreadable
 * record). Awaited by the guard, so a connector can pass the pending read.
 */
export type EvmConnectionsAtLoad =
  | readonly EvmConnectionAtLoad[]
  | null
  | Promise<readonly EvmConnectionAtLoad[] | null>

/**
 * Read the EVM connections wagmi persisted, as of now. Those are the ones
 * the previous page held on purpose: an adoption the guard detached is gone
 * from them, and so is anything disconnected.
 *
 * Call it from inside a connector's creator function: wagmi's `createConfig`
 * builds the connectors first and then creates its store, which overwrites
 * the record with an empty one straight away (with or without `ssr`), so
 * the record is only readable in that window. The underlying storage read
 * happens synchronously inside the call; only its result is awaited.
 */
export function readEvmConnectionsAtLoad(
  storage:
    | { getItem(key: string, ...rest: never[]): unknown }
    | null
    | undefined,
): Promise<readonly EvmConnectionAtLoad[] | null> {
  if (!storage) return Promise.resolve(null)
  // The record sits under wagmi's `store` key, which its storage type does
  // not list. Read now, not in a microtask: the overwrite is next.
  let pending: unknown
  try {
    pending = storage.getItem('store')
  } catch {
    return Promise.resolve(null)
  }
  return Promise.resolve(pending)
    .then((persisted) => {
      const connections = (
        persisted as { state?: { connections?: unknown } } | null
      )?.state?.connections
      if (!(connections instanceof Map)) return null
      const list: EvmConnectionAtLoad[] = []
      for (const connection of connections.values()) {
        const connector = (
          connection as { connector?: { id?: unknown; name?: unknown } }
        )?.connector
        if (
          typeof connector?.id !== 'string' ||
          typeof connector.name !== 'string'
        ) {
          continue
        }
        list.push({ id: connector.id, name: connector.name })
      }
      return list
    })
    .catch(() => null)
}

/**
 * Whether `wallet` was connected on the EVM side when the page loaded, per
 * the record `readEvmConnectionsAtLoad` took. No record reads as not
 * connected: the guard then stands in, which costs the host nothing when
 * the wallet is indeed dormant.
 */
async function wasConnectedAtLoad(
  wallet: WalletRef,
  restored: EvmConnectionsAtLoad,
): Promise<boolean> {
  const list = await restored
  return list?.some((c) => isSameWallet(c, wallet)) ?? false
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
 * Keep the EVM side of `wallet`, a multichain wallet whose Solana
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
 * the host's own connections are never touched; `restored` is the record
 * the kit connector took at load, see `readEvmConnectionsAtLoad`): write the
 * shim again,
 * ahead of the sweep where the ordering allows; take the self-connect
 * listener off; and once the sweep has settled, detach what it adopted all
 * the same, at wagmi's state level (the wallet's permission is left alone,
 * see `detachFromWagmiState`). A connection the host asks for, meanwhile or
 * before the guard mounted, is declared through `allowEvmConnection` and
 * kept; one the host made through wagmi directly is not, so a host should
 * mount the kit hook before it connects EVM through a wallet that also
 * serves Solana.
 *
 * The sweep is watched once per page load, whichever guard instance gets
 * there first: the muting and the shim are repeated for connectors that
 * arrive later (under `ssr` wagmi sets the EIP-6963 connectors up in its
 * mount effect, after the guard mounts; a provider can also announce itself
 * late), and a guard mounted after the sweep has been judged does only
 * that. Both leave a connected wallet alone, so a connection the host made
 * in between stays, and so does one made before a later mount.
 */
export function guardDormantEvmSide(
  config: Config,
  wallet: WalletRef,
  restored: EvmConnectionsAtLoad,
): () => void {
  let stopped = false
  let stopWatch: (() => void) | undefined
  let stopConnectors: (() => void) | undefined
  const guard = async () => {
    if (await wasConnectedAtLoad(wallet, restored)) return
    if (stopped) return
    muteDormantEvmSide(config, wallet)
    await shimDormantEvmSide(config, wallet)
    if (stopped) return
    stopConnectors = config._internal.connectors.subscribe(() => {
      muteDormantEvmSide(config, wallet)
      shimDormantEvmSide(config, wallet).catch(() => {})
    })
    if (sweptConfigs.has(config)) return
    stopWatch = afterReconnectSettles(config, () => {
      sweptConfigs.add(config)
      for (const [uid, { connector }] of config.state.connections) {
        if (isExplicitEvmConnection(config, uid)) continue
        if (!isInstalledEvmConnector(connector)) continue
        if (!isSameWallet(connector, wallet)) continue
        // The state-level drop is synchronous; only the storage writes
        // after it can fail, and a failed shim costs nothing here.
        detachEvmConnection(config, uid).catch(() => {})
      }
    })
  }
  // Best effort: with storage unwritable the guard stands down.
  guard().catch(() => {})
  return () => {
    stopped = true
    stopConnectors?.()
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
  wallet: WalletRef,
): Promise<void> {
  for (const connector of dormantEvmConnectors(config, wallet)) {
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
  wallet: WalletRef,
  run: () => Promise<T>,
): Promise<T> {
  const before = new Set(config.state.connections.keys())

  const detach = (uid: string) => {
    // Asked for by the host: not an adoption. Remember it as pre-existing for
    // this guard: the host's connect may settle (and its exemption end) while
    // the Solana prompt is still open, and the sweep after `run` must not
    // read the connection as an adoption then.
    if (isExplicitEvmConnection(config, uid)) {
      before.add(uid)
      return
    }
    const connector = config.state.connections.get(uid)?.connector
    if (!connector) return
    // Only an extension adopts a site on its own; a session the host opened
    // through another kind of connector meanwhile is its own.
    if (!isInstalledEvmConnector(connector)) return
    if (!isSameWallet(connector, wallet)) return
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
    if (connected) await shimDormantEvmSide(config, wallet)
    setTimeout(() => {
      sweep()
      unsubscribe()
    }, GRACE_MS)
  }
}
