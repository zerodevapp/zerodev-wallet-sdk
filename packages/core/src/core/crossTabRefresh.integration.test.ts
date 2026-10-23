/**
 * Flow: two browser tabs of one origin refresh the same session at the same
 * instant (DPL-798).
 *
 * Tabs share the key vault (IndexedDB) and session storage, but each loads its
 * own copy of this module, so the module-level key-transition queue does not
 * serialize them. Each tab's stamper also caches the vault key in memory, like
 * Turnkey's IndexedDbStamper. The KMS stub fails a stamp login that overlaps
 * another one, as Turnkey does for one sub-org.
 */
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'

const ORG = 'org-a'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

/** The shared IndexedDB slot. */
function vault() {
  return { key: null as string | null, minted: 0 }
}

/**
 * One tab's stamper: reads the vault at load, then signs from memory.
 * `hold.commit`, when set, delays writing a committed key to the vault.
 */
function tabStamper(
  v: ReturnType<typeof vault>,
  hold: {
    commit?: Promise<void>
    /** Delays the next reload's vault read, after `reloading` is called. */
    reload?: Promise<void>
    reloading?: () => void
    /** Makes the next key commit fail before it writes anything. */
    failCommit?: boolean
  } = {},
): ApiKeyStamper & {
  activeKey: () => string | null
} {
  let active = v.key
  let pending: string | null = null
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: `stamp:${active}`,
  })
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
      v.key = null
    },
    getPublicKey: async () => active,
    resetKeyPair: async () => {
      active = sessionKey(++v.minted)
      v.key = active
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++v.minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      if (hold.failCommit) {
        delete hold.failCommit
        throw new Error('Vault write failed')
      }
      await hold.commit
      if (pending) {
        active = pending
        v.key = pending
      }
      pending = null
    },
    discardKeyRotation: async () => {
      pending = null
    },
    // Like Turnkey's init(): an empty vault gets a freshly generated key.
    reload: async () => {
      const held = hold.reload
      if (held) {
        delete hold.reload
        hold.reloading?.()
        await held
      }
      if (!v.key) v.key = sessionKey(++v.minted)
      active = v.key
    },
    sign: async () => 'sig',
    activeKey: () => active,
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({ stampHeaderName: 'X-Stamp', stampHeaderValue: 'pk' }),
  clear: async () => {},
  register: async () => ({
    attestation: {
      attestationObject: 'ao',
      clientDataJson: 'cdj',
      credentialId: 'cred-1',
    },
    encodedChallenge: 'challenge',
  }),
}

function token(publicKey: string, org = ORG) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: `user-of-${org}`,
      organization_id: org,
    }),
  )}.sig`
}

function sharedStorage(): StorageAdapter {
  const store = new Map<string, string>()
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
}

/**
 * Counts stamp logins and, unless `queue` is set, fails one that overlaps
 * another in flight. `events` records each stamp login's start and end, tagged
 * by the stamp in its body: an API-key stamp is a refresh, a passkey stamp is
 * a login.
 */
function stubKms(opts: { queue?: boolean } = {}) {
  const kms = {
    stampLogins: 0,
    failed: 0,
    inFlight: 0,
    events: [] as string[],
    /** The organization the next stamp login signs in to. */
    org: ORG,
    /** The stamp each stamp login carried. */
    loginStamps: [] as string[],
    /** Signs each signing request's payload, e.g. as a wallet that isn't the owner. */
    signer: undefined as ReturnType<typeof privateKeyToAccount> | undefined,
    /** Delay before the key list answers, i.e. a logout's revoke in flight. */
    authenticatorsDelayMs: 0,
    /** Session keys the key list reports, by public key. */
    sessionKeys: [] as string[],
    /** Session requests: the stamp they carry, their bearer and any revoked keys. */
    requests: [] as {
      path: string
      stamp: string | undefined
      bearer: string | undefined
      revoked?: string[]
    }[],
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url)
      const body = init?.body ? JSON.parse(String(init.body)) : {}
      const json = (payload: unknown, status = 200) =>
        new Response(JSON.stringify(payload), {
          status,
          headers: { 'content-type': 'application/json' },
        })
      if (path.includes('server-info/parent-org-id')) {
        return json({ parentOrgId: 'parent-org' })
      }
      if (path.includes('/auth/login/stamp')) {
        const kind = String(body.stamp?.stampHeaderValue).startsWith('stamp:')
          ? 'refresh'
          : 'login'
        kms.stampLogins++
        kms.loginStamps.push(String(body.stamp?.stampHeaderValue))
        if (kms.inFlight > 0 && !opts.queue) {
          kms.failed++
          return json({ error: 'ACTIVITY_STATUS_FAILED' }, 500)
        }
        kms.inFlight++
        kms.events.push(`${kind}:start`)
        await new Promise((resolve) => setTimeout(resolve, 20))
        kms.events.push(`${kind}:end`)
        kms.inFlight--
        return json({ session: token(body.targetPublicKey, kms.org) })
      }
      const headers = (init?.headers ?? {}) as Record<string, string>
      const record = (revoked?: string[]) =>
        kms.requests.push({
          path: path.split('/').slice(-2).join('/'),
          stamp: headers['X-Stamp'] ?? body.stamp?.stampHeaderValue,
          bearer: headers.Authorization?.replace('Bearer ', ''),
          ...(revoked && { revoked }),
        })
      if (path.includes('auth/logout')) {
        record(body.parameters?.apiKeyIds)
        return json({ ok: true })
      }
      if (path.includes('authenticators')) {
        record()
        await new Promise((resolve) =>
          setTimeout(resolve, kms.authenticatorsDelayMs),
        )
        return json({
          sessionKeys: kms.sessionKeys.map((key) => ({
            apiKey: key,
            turnkeyId: `turnkey-${key}`,
          })),
        })
      }
      if (path.endsWith('/wallets')) {
        record()
        return json({
          walletAddresses: ['0x1111111111111111111111111111111111111111'],
        })
      }
      if (path.endsWith('sign/message')) {
        record()
        if (!kms.signer) return json({ error: 'not signing in this test' }, 500)
        const hash = `0x${body.turnkeyPayload.parameters.payload}` as const
        return json({ signature: await kms.signer.sign({ hash }) })
      }
      return json({}, 404)
    }),
  )
  return kms
}

/**
 * An in-memory stand-in for `navigator.locks`: exclusive requests run one at a
 * time, shared ones run together but never alongside an exclusive one, and
 * requests are granted in order.
 */
function webLocks() {
  type Holders = { exclusive: Promise<unknown>; shared: Promise<unknown>[] }
  const locks = new Map<string, Holders>()
  return {
    request: <T>(
      name: string,
      options: { mode?: LockMode },
      task: () => Promise<T>,
    ): Promise<T> => {
      const held = locks.get(name) ?? {
        exclusive: Promise.resolve(),
        shared: [],
      }
      const settle = (p: Promise<unknown>) => p.catch(() => undefined)
      if (options.mode === 'shared') {
        const run = held.exclusive.then(() => task())
        locks.set(name, { ...held, shared: [...held.shared, settle(run)] })
        return run
      }
      const run = Promise.all([held.exclusive, ...held.shared]).then(() =>
        task(),
      )
      locks.set(name, { exclusive: settle(run), shared: [] })
      return run
    },
  }
}

/** A fresh module instance, as a separate tab would load. */
async function loadTab() {
  vi.resetModules()
  return (await import('./createZeroDevWalletCore.js')).createZeroDevWalletCore
}

/** A passkey prompt the user never answers. */
const abandonedPrompt: PasskeyStamper = {
  ...passkeyStamper,
  stamp: () => new Promise(() => {}),
  register: () => new Promise(() => {}),
}

/** Rejects if `promise` is still pending after `ms`, e.g. stuck on a lock. */
const within = <T>(promise: Promise<T>, ms = 500) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('still blocked')), ms),
    ),
  ])

function origin(opts: { queue?: boolean } = {}) {
  const kms = stubKms(opts)
  const v = vault()
  const adapter = sharedStorage()
  const open = async (
    tab: {
      hold?:
        | {
            commit?: Promise<void>
            reload?: Promise<void>
            reloading?: () => void
            failCommit?: boolean
          }
        | undefined
      passkey?: PasskeyStamper
    } = {},
  ) => {
    const stamper = tabStamper(v, tab.hold)
    const core = await (await loadTab())({
      projectId: 'project-a',
      rpId: 'localhost',
      sessionStorage: adapter,
      apiKeyStamper: stamper,
      passkeyStamper: tab.passkey ?? passkeyStamper,
      proxyBaseUrl: 'https://kms.test.invalid/api/v1',
    })
    return { core, stamper }
  }
  return { kms, v, adapter, open }
}

async function twoTabs(
  opts: { queue?: boolean; holdA?: { commit?: Promise<void> } } = {},
) {
  const { kms, v, open } = origin(opts)
  const tabA = await open({ hold: opts.holdA })
  await tabA.core.auth({ type: 'passkey', mode: 'login' })
  const tabB = await open()
  kms.stampLogins = 0
  kms.events.length = 0
  return { kms, v, tabA, tabB, open }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cross-tab session refresh', () => {
  it('sends one stamp login and both tabs end on its session and key', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()

    const [fromA, fromB] = await Promise.all([
      tabA.core.refreshSession(before?.id),
      tabB.core.refreshSession(before?.id),
    ])

    expect(kms.stampLogins).toBe(1)
    expect(kms.failed).toBe(0)
    expect(fromA?.id).not.toBe(before?.id)
    expect(fromB?.id).toBe(fromA?.id)
    expect(tabA.stamper.activeKey()).toBe(v.key)
    expect(tabB.stamper.activeKey()).toBe(v.key)
    expect(fromB?.publicKey).toBe(v.key)
  })

  it('a tab refreshing after another already did adopts instead of sending a second', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()

    const fromA = await tabA.core.refreshSession(before?.id)
    const fromB = await tabB.core.refreshSession(before?.id)

    expect(kms.stampLogins).toBe(1)
    expect(fromB?.id).toBe(fromA?.id)
    expect(tabB.stamper.activeKey()).toBe(fromA?.publicKey)
  })

  it('a refresh without an id also adopts instead of rotating twice', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()

    const [fromA, fromB] = await Promise.all([
      tabA.core.refreshSession(),
      tabB.core.refreshSession(),
    ])

    expect(kms.stampLogins).toBe(1)
    expect(fromB?.id).toBe(fromA?.id)
    expect(tabB.stamper.activeKey()).toBe(v.key)
  })

  it("keeps the vault and stored session in step when a login commits during another tab's refresh", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const holdA: { commit?: Promise<void> } = {}
    const { v, tabA, tabB } = await twoTabs({ queue: true, holdA })
    const before = await tabA.core.getSession()
    let release = () => {}
    holdA.commit = new Promise((resolve) => {
      release = resolve
    })

    // A's refresh pauses mid-commit; B's login runs as far as it can.
    const refreshing = tabA.core.refreshSession(before?.id)
    const loggingIn = tabB.core.auth({ type: 'passkey', mode: 'login' })
    await new Promise((resolve) => setTimeout(resolve, 100))
    release()
    const results = await Promise.allSettled([refreshing, loggingIn])

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled'])
    expect((await tabB.core.getSession())?.publicKey).toBe(v.key)
  })

  it('an abandoned passkey prompt in one tab blocks neither startup nor refresh in others', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { tabA, open } = await twoTabs()
    const before = await tabA.core.getSession()

    const promptTab = await open({ passkey: abandonedPrompt })
    promptTab.core.auth({ type: 'passkey', mode: 'login' }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    await expect(within(open())).resolves.toBeDefined()
    await expect(
      within(tabA.core.refreshSession(before?.id)),
    ).resolves.toBeDefined()
  })

  it('an abandoned passkey registration does not block another tab from starting', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { open } = origin()

    const promptTab = await open({ passkey: abandonedPrompt })
    promptTab.core.auth({ type: 'passkey', mode: 'register' }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 20))

    await expect(within(open())).resolves.toBeDefined()
  })

  it('does not write a key into the vault after another tab logged out', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()

    // force: the stub KMS lists no remote key to revoke.
    await tabA.core.logout({ force: true })
    expect(v.key).toBeNull()

    await expect(tabB.core.refreshSession(before?.id)).rejects.toThrow(
      /no active session/i,
    )
    expect(v.key).toBeNull()
    expect(kms.stampLogins).toBe(0)
  })

  it("a tab opened during another tab's refresh keeps the refreshed session", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const holdA: { commit?: Promise<void> } = {}
    const { v, tabA, open } = await twoTabs({ holdA })
    const before = await tabA.core.getSession()
    let release = () => {}
    holdA.commit = new Promise((resolve) => {
      release = resolve
    })

    // B's stamper reads the vault now, before A commits the new key.
    const refreshing = tabA.core.refreshSession(before?.id)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const opening = open()
    await new Promise((resolve) => setTimeout(resolve, 20))
    release()
    const [refreshed, tabC] = await Promise.all([refreshing, opening])

    await expect(tabC.core.getSession()).resolves.toMatchObject({
      id: refreshed?.id,
      publicKey: v.key,
    })
  })

  // The logout holds the lock for its whole run, so B's login commits after it.
  it("a logout keeps another account's session that signed in while the revoke was in flight", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs({ queue: true })
    kms.authenticatorsDelayMs = 100

    const loggingOut = tabA.core.logout({ force: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    kms.org = 'org-b'
    await tabB.core.auth({ type: 'passkey', mode: 'login' })
    await loggingOut

    const current = await tabB.core.getSession()
    expect(current?.organizationId).toBe('org-b')
    expect(current?.publicKey).toBe(v.key)
  })

  it('a refresh queued behind a logout finds no session and does not rotate', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()
    kms.authenticatorsDelayMs = 100

    const loggingOut = tabA.core.logout({ force: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    // The logout holds the lock for its whole revoke, so the refresh waits for
    // it and then finds nothing left to refresh.
    const refreshing = tabB.core.refreshSession(before?.id)
    await loggingOut
    await expect(refreshing).rejects.toThrow(/no active session/i)

    await expect(tabB.core.getSession()).resolves.toBeUndefined()
    expect(v.key).toBeNull()
    expect(kms.stampLogins).toBe(0)
  })
})

describe('requests from a tab another tab has moved on from', () => {
  it("signs with the key another tab's refresh rotated in, paired with its token", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()

    const refreshed = await tabA.core.refreshSession(before?.id)
    await expect(account.signMessage({ message: 'hello' })).rejects.toThrow()

    const signing = kms.requests.find((r) => r.path === 'sign/message')
    expect(signing?.bearer).toBe(refreshed?.token)
    expect(signing?.stamp).toBe(`stamp:${v.key}`)
    expect(tabB.stamper.activeKey()).toBe(v.key)
  })

  it("waits for another tab's refresh commit, then signs with its token and key", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const holdA: { commit?: Promise<void> } = {}
    const { kms, v, tabA, tabB } = await twoTabs({ holdA })
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()
    let release = () => {}
    holdA.commit = new Promise((resolve) => {
      release = resolve
    })

    // A's refresh pauses mid-commit, holding the lock; B's signature waits.
    const refreshing = tabA.core.refreshSession(before?.id)
    await new Promise((resolve) => setTimeout(resolve, 50))
    const signing = account.signMessage({ message: 'hello' }).catch(() => {})
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(kms.requests.some((r) => r.path === 'sign/message')).toBe(false)

    release()
    const refreshed = await refreshing
    await signing
    const signed = kms.requests.find((r) => r.path === 'sign/message')
    expect(signed?.bearer).toBe(refreshed?.token)
    expect(signed?.stamp).toBe(`stamp:${v.key}`)
  })

  it("still refuses a signature that doesn't recover to the account's owner", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, tabB } = await twoTabs()
    const account = await tabB.core.toAccount()
    kms.signer = privateKeyToAccount(generatePrivateKey())

    await expect(account.signMessage({ message: 'hello' })).rejects.toThrow(
      /did not recover/,
    )
    expect(kms.requests.some((r) => r.path === 'sign/message')).toBe(true)
  })

  it('refuses to sign once another tab signed in to another account', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, tabA, tabB } = await twoTabs()
    const account = await tabB.core.toAccount()

    kms.org = 'org-b'
    await tabA.core.auth({ type: 'passkey', mode: 'login' })

    await expect(account.signMessage({ message: 'hello' })).rejects.toThrow(
      /another owner/,
    )
    expect(kms.requests.some((r) => r.path === 'sign/message')).toBe(false)
  })

  it("stamps a refresh with the key another tab rotated in, given that tab's session", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()
    const refreshed = await tabA.core.refreshSession(before?.id)
    const rotated = v.key
    kms.events.length = 0

    // B learned of A's session, e.g. from a storage event, but never signed.
    kms.loginStamps.length = 0
    const next = await tabB.core.refreshSession(refreshed?.id)

    expect(kms.events).toEqual(['refresh:start', 'refresh:end'])
    expect(kms.loginStamps).toEqual([`stamp:${rotated}`])
    expect(next?.id).not.toBe(refreshed?.id)
    expect(tabB.stamper.activeKey()).toBe(v.key)
    expect(v.key).not.toBe(rotated)
  })

  it("adopts another tab's refresh after a signature already reloaded its key", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, tabA, tabB } = await twoTabs()
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()
    const refreshed = await tabA.core.refreshSession(before?.id)
    await account.signMessage({ message: 'hello' }).catch(() => {})
    // The signature took over A's key, so the refresh below can't see it change.
    expect(tabB.stamper.activeKey()).toBe(refreshed?.publicKey)
    kms.stampLogins = 0

    await expect(tabB.core.refreshSession(before?.id)).resolves.toMatchObject({
      id: refreshed?.id,
    })
    expect(kms.stampLogins).toBe(0)
  })

  it("without Web Locks, a failed key commit during a reload doesn't hide another tab's refresh", async () => {
    vi.stubGlobal('navigator', undefined)
    const hold: {
      commit?: Promise<void>
      reload?: Promise<void>
      reloading?: () => void
      failCommit?: boolean
    } = {}
    const { kms, open } = origin()
    const tabA = await open()
    await tabA.core.auth({ type: 'passkey', mode: 'login' })
    const tabB = await open({ hold })
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()
    const refreshed = await tabA.core.refreshSession(before?.id)

    // B's request reloads A's key; while that reload is open, B's own login fails to commit its key.
    let reloadStarted = () => {}
    const reloading = new Promise<void>((resolve) => {
      reloadStarted = resolve
    })
    let finishReload = () => {}
    hold.reload = new Promise<void>((resolve) => {
      finishReload = resolve
    })
    hold.reloading = reloadStarted
    const signing = account.signMessage({ message: 'hello' }).catch(() => {})
    await reloading
    hold.failCommit = true
    await expect(
      tabB.core.auth({ type: 'passkey', mode: 'login' }),
    ).rejects.toThrow()
    finishReload()
    await signing
    kms.stampLogins = 0

    await expect(tabB.core.refreshSession(before?.id)).resolves.toMatchObject({
      id: refreshed?.id,
    })
    expect(kms.stampLogins).toBe(0)
  })

  it("without Web Locks, a login failing to stage during a reload doesn't hide another tab's refresh", async () => {
    vi.stubGlobal('navigator', undefined)
    const hold: {
      commit?: Promise<void>
      reload?: Promise<void>
      reloading?: () => void
    } = {}
    const { kms, adapter, open } = origin()
    const tabA = await open()
    await tabA.core.auth({ type: 'passkey', mode: 'login' })
    const tabB = await open({ hold })
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()
    const refreshed = await tabA.core.refreshSession(before?.id)

    // B's request reloads A's key; while that reload is open, B's own login fails to stage.
    let reloadStarted = () => {}
    const reloading = new Promise<void>((resolve) => {
      reloadStarted = resolve
    })
    let finishReload = () => {}
    hold.reload = new Promise<void>((resolve) => {
      finishReload = resolve
    })
    hold.reloading = reloadStarted
    const signing = account.signMessage({ message: 'hello' }).catch(() => {})
    await reloading
    const setItem = adapter.setItem
    adapter.setItem = (key, value) => {
      if (key === '@zerodev/session_transition') throw new Error('Storage full')
      return setItem(key, value)
    }
    await expect(
      tabB.core.auth({ type: 'passkey', mode: 'login' }),
    ).rejects.toThrow()
    adapter.setItem = setItem
    finishReload()
    await signing
    kms.stampLogins = 0

    await expect(tabB.core.refreshSession(before?.id)).resolves.toMatchObject({
      id: refreshed?.id,
    })
    expect(kms.stampLogins).toBe(0)
  })

  it("still adopts another tab's refresh after this tab's own login failed to stage", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, adapter, open } = origin()
    const tabA = await open()
    await tabA.core.auth({ type: 'passkey', mode: 'login' })
    const tabB = await open()
    const before = await tabB.core.getSession()
    const account = await tabB.core.toAccount()
    const refreshed = await tabA.core.refreshSession(before?.id)
    await account.signMessage({ message: 'hello' }).catch(() => {})

    // B's next login can't write its transition journal, so no key of its own commits.
    const setItem = adapter.setItem
    adapter.setItem = (key, value) => {
      if (key === '@zerodev/session_transition') throw new Error('Storage full')
      return setItem(key, value)
    }
    await expect(
      tabB.core.auth({ type: 'passkey', mode: 'login' }),
    ).rejects.toThrow()
    adapter.setItem = setItem
    kms.stampLogins = 0

    await expect(tabB.core.refreshSession(before?.id)).resolves.toMatchObject({
      id: refreshed?.id,
    })
    expect(kms.stampLogins).toBe(0)
  })

  it("without Web Locks, a request during this tab's own refresh doesn't make a stale id adopt", async () => {
    vi.stubGlobal('navigator', undefined)
    const { adapter, open } = origin()
    const tab = await open()
    await tab.core.auth({ type: 'passkey', mode: 'login' })
    const before = await tab.core.getSession()
    const account = await tab.core.toAccount()

    // Pause the refresh after its key commits, before its session does.
    let paused = () => {}
    const reachedCommit = new Promise<void>((resolve) => {
      paused = resolve
    })
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const getItem = adapter.getItem
    let pause = true
    adapter.getItem = async (key) => {
      if (pause && key === '@zerodev/session_transition') {
        pause = false
        paused()
        await released
      }
      return getItem(key)
    }
    const refreshing = tab.core.refreshSession(before?.id)
    await reachedCommit
    // The key has committed and the session hasn't, the window under test.
    expect(tab.stamper.activeKey()).not.toBe(before?.publicKey)
    await account.signMessage({ message: 'hello' }).catch(() => {})
    release()
    await refreshing
    adapter.getItem = getItem

    await expect(tab.core.refreshSession(before?.id)).rejects.toThrow(
      /inactive session/i,
    )
  })

  it("without Web Locks, a reload spanning this tab's own refreshes doesn't make a stale id adopt", async () => {
    vi.stubGlobal('navigator', undefined)
    const hold: {
      commit?: Promise<void>
      reload?: Promise<void>
      reloading?: () => void
    } = {}
    const { adapter, open } = origin()
    const tab = await open({ hold })
    await tab.core.auth({ type: 'passkey', mode: 'login' })
    const before = await tab.core.getSession()
    const account = await tab.core.toAccount()

    // Pause the first refresh after its key commits, before its session does.
    let paused = () => {}
    const reachedCommit = new Promise<void>((resolve) => {
      paused = resolve
    })
    let release = () => {}
    const released = new Promise<void>((resolve) => {
      release = resolve
    })
    const getItem = adapter.getItem
    let pause = true
    adapter.getItem = async (key) => {
      if (pause && key === '@zerodev/session_transition') {
        pause = false
        paused()
        await released
      }
      return getItem(key)
    }
    const refreshing = tab.core.refreshSession(before?.id)
    await reachedCommit

    // A request reloads the key, and its reload stays open across both refreshes.
    let reloadStarted = () => {}
    const reloading = new Promise<void>((resolve) => {
      reloadStarted = resolve
    })
    let finishReload = () => {}
    hold.reload = new Promise<void>((resolve) => {
      finishReload = resolve
    })
    hold.reloading = reloadStarted
    const signing = account.signMessage({ message: 'hello' }).catch(() => {})
    await reloading
    release()
    const first = await refreshing
    adapter.getItem = getItem
    await tab.core.refreshSession(first?.id)
    finishReload()
    await signing

    await expect(tab.core.refreshSession(before?.id)).rejects.toThrow(
      /inactive session/i,
    )
  })

  it('a forced logout still clears a session whose token cannot be read', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { v, adapter, open } = origin()
    const tab = await open()
    await tab.core.auth({ type: 'passkey', mode: 'login' })
    const stored = await tab.core.getSession()
    if (!stored) throw new Error('Expected a session')
    const { publicKey: _, ...withoutKey } = stored
    adapter.setItem(stored.id, JSON.stringify({ ...withoutKey, token: 'nope' }))

    // Unforced, it is an ambiguous failure: nothing changes and logout reports false.
    await expect(tab.core.logout()).resolves.toBe(false)
    await expect(tab.core.getSession()).resolves.toBeDefined()

    await expect(tab.core.logout({ force: true })).resolves.toBe(true)
    await expect(tab.core.getSession()).resolves.toBeUndefined()
    expect(v.key).toBeNull()
  })

  it("revokes the key another tab's refresh rotated in on logout", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabB.core.getSession()
    await tabA.core.refreshSession(before?.id)
    kms.sessionKeys = [v.key as string]

    await expect(tabB.core.logout()).resolves.toBe(true)

    const revoke = kms.requests.find((r) => r.path === 'auth/logout')
    expect(revoke?.revoked).toEqual([`turnkey-${kms.sessionKeys[0]}`])
    expect(v.key).toBeNull()
  })

  it("leaves another account's session alone when logging out this one", async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const mine = await tabB.core.getSession()
    kms.org = 'org-b'
    await tabA.core.auth({ type: 'passkey', mode: 'login' })
    const theirs = v.key
    kms.requests.length = 0

    await expect(
      tabB.core.logout({
        force: true,
        account: {
          organizationId: mine?.organizationId as string,
          userId: mine?.userId as string,
        },
      }),
    ).resolves.toBe(true)

    expect(kms.requests).toEqual([])
    expect((await tabA.core.getSession())?.organizationId).toBe('org-b')
    expect(v.key).toBe(theirs)
  })

  it('leaves a newer session of the same account when clearing a rejected one', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const rejected = await tabB.core.getSession()
    if (!rejected) throw new Error('Expected a session to reject')
    const refreshed = await tabA.core.refreshSession(rejected.id)
    kms.requests.length = 0

    await expect(
      tabB.core.logout({ force: true, sessionId: rejected.id }),
    ).resolves.toBe(true)

    expect(kms.requests).toEqual([])
    expect((await tabA.core.getSession())?.id).toBe(refreshed?.id)
    expect(v.key).toBe(refreshed?.publicKey)
  })
})
