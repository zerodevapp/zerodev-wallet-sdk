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
  hold: { commit?: Promise<void> } = {},
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
    /** Delay before the key list answers, i.e. a logout's revoke in flight. */
    authenticatorsDelayMs: 0,
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
      if (path.includes('auth/logout')) return json({ ok: true })
      if (path.includes('authenticators')) {
        await new Promise((resolve) =>
          setTimeout(resolve, kms.authenticatorsDelayMs),
        )
        return json({ sessionKeys: [] })
      }
      return json({}, 404)
    }),
  )
  return kms
}

/** An exclusive, in-memory stand-in for `navigator.locks`. */
function webLocks() {
  const tails = new Map<string, Promise<unknown>>()
  return {
    request: <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const run = (tails.get(name) ?? Promise.resolve()).then(() => task())
      tails.set(
        name,
        run.catch(() => undefined),
      )
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
      hold?: { commit?: Promise<void> } | undefined
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
  return { kms, v, open }
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

  it('a logout still clears a same-account session another tab refreshed meanwhile', async () => {
    vi.stubGlobal('navigator', { locks: webLocks() })
    const { kms, v, tabA, tabB } = await twoTabs()
    const before = await tabA.core.getSession()
    kms.authenticatorsDelayMs = 100

    const loggingOut = tabA.core.logout({ force: true })
    await new Promise((resolve) => setTimeout(resolve, 20))
    await tabB.core.refreshSession(before?.id)
    await loggingOut

    await expect(tabB.core.getSession()).resolves.toBeUndefined()
    expect(v.key).toBeNull()
  })
})
