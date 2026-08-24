/**
 * Boundary: Wallet Core <-> the key store and session storage, inside
 * `commitReplacementSession` — the two-phase commit all five authenticated flows
 * share.
 *
 * Order is: stage a journal entry, promote the pending key, commit the journal.
 * Both later steps recover through `recoverSessionTransition`, which honours a
 * journal only if its `publicKey` is the key now active — that comparison is how
 * "the rotation happened, the error was cosmetic" is told from "it did not". The
 * same journal is crash recovery, completed on the next construction.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

/** The storage key the journal lives under, needed to break it on purpose. */
const JOURNAL = '@zerodev/session_transition'

const sessionKey = (nth: number) => `02${String(nth).padStart(64, '0')}`

type KeyStoreScript = {
  /** Fail every `commitKeyRotation` without promoting the pending key. */
  commitFails?: boolean
  /** Fail only the first `commitKeyRotation` — a transient outage. */
  commitFailsOnce?: boolean
  /** Promote the key and THEN fail: the write landed, the acknowledgement did not. */
  commitPromotesThenFails?: boolean
  /** Fail the rollback that runs inside the commit-failure handler. */
  discardFails?: boolean
  /** Fail the key read that the commit-failure handler makes. */
  readFailsAfterCommitFailure?: boolean
  /**
   * Start out holding the nth key. Needed to reach the key-ownership branch: a
   * store holding NO key is rejected before the comparison runs.
   */
  holdingKey?: number
}

const COMMIT_FAILURE = 'key store commit failed'
const DISCARD_FAILURE = 'key store cannot discard'
const READ_FAILURE = 'key store unreadable'

function keyStore(script: KeyStoreScript = {}): ApiKeyStamper & {
  activeKey: () => string | null
} {
  let minted = script.holdingKey ?? 0
  let active: string | null = script.holdingKey ? sessionKey(minted) : null
  let pending: string | null = null
  let commits = 0
  let commitHasFailed = false
  const stamp = async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  })
  const promote = () => {
    if (pending) active = pending
    pending = null
  }
  return {
    stamp,
    clear: async () => {
      active = null
      pending = null
    },
    getPublicKey: async () => {
      if (script.readFailsAfterCommitFailure && commitHasFailed) {
        throw new Error(READ_FAILURE)
      }
      return active
    },
    resetKeyPair: async () => {
      active = sessionKey(++minted)
    },
    prepareKeyRotation: async () => {
      pending = sessionKey(++minted)
      return pending
    },
    stampPending: stamp,
    signPending: async () => 'sig',
    commitKeyRotation: async () => {
      const attempt = commits++
      if (script.commitPromotesThenFails) {
        promote()
        commitHasFailed = true
        throw new Error(COMMIT_FAILURE)
      }
      if (script.commitFails || (script.commitFailsOnce && attempt === 0)) {
        commitHasFailed = true
        throw new Error(COMMIT_FAILURE)
      }
      promote()
    },
    discardKeyRotation: async () => {
      if (script.discardFails) throw new Error(DISCARD_FAILURE)
      pending = null
    },
    sign: async () => 'sig',
    activeKey: () => active,
  }
}

const passkeyStamper: PasskeyStamper = {
  stamp: async () => ({
    stampHeaderName: 'X-Stamp',
    stampHeaderValue: 'stamp',
  }),
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

function token(publicKey: string) {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'suborg-1',
    }),
  )}.sig`
}

type StorageScript = {
  /** Fail the journal write, so nothing is ever staged. */
  stageFails?: boolean
  /** Fail journal reads once it has been staged. */
  journalReadFails?: boolean
  /** Drop the journal the instant it is written. */
  journalVanishes?: boolean
}

/** Backed by a plain Map so the store can be re-read by a second instance. */
function storage(
  script: StorageScript = {},
  store = new Map<string, string>(),
) {
  let staged = false
  const adapter: StorageAdapter = {
    getItem: (key) => {
      if (script.journalReadFails && key === JOURNAL && staged) {
        throw new Error('storage read failed')
      }
      return store.get(key) ?? null
    },
    setItem: (key, value) => {
      if (script.stageFails && key === JOURNAL) {
        throw new Error('storage write failed')
      }
      store.set(key, value)
      if (key === JOURNAL) {
        staged = true
        if (script.journalVanishes) store.delete(key)
      }
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
  return { adapter, store }
}

function stubKms() {
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
        return json({ session: token(body.targetPublicKey) })
      }
      return json({}, 404)
    }),
  )
}

async function build(opts: { api: ApiKeyStamper; adapter: StorageAdapter }) {
  return createZeroDevWalletCore({
    projectId: 'proj',
    rpId: 'localhost',
    sessionStorage: opts.adapter,
    apiKeyStamper: opts.api,
    passkeyStamper,
    proxyBaseUrl: 'https://kms.test.invalid/api/v1',
  })
}

const login = { type: 'passkey', mode: 'login' } as const

const caught = (p: Promise<unknown>) =>
  p.then(
    () => 'RESOLVED' as const,
    (e: unknown) => e,
  )

/**
 * Walks the `cause` chain, so rethrowing the original, wrapping it, or
 * aggregating all pass — a generic `Error('key store failure')` does not.
 */
function blames(error: unknown, text: string): boolean {
  let current: unknown = error
  for (let depth = 0; current instanceof Error && depth < 5; depth += 1) {
    if (current.message.includes(text)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('session commit: the control', () => {
  it('promotes the key, stores the session and consumes the journal', async () => {
    stubKms()
    const api = keyStore()
    const { adapter, store } = storage()

    await (await build({ api, adapter })).auth(login)

    expect(api.activeKey()).toBe(sessionKey(1))
    expect(store.has(JOURNAL)).toBe(false)
  })
})

describe('session commit: the key rotation fails outright', () => {
  it('reports the key store and leaves nothing half-committed', async () => {
    stubKms()
    const api = keyStore({ commitFails: true })
    const { adapter, store } = storage()
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(blames(error, COMMIT_FAILURE)).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
    // No key was promoted, so the journal can never match a live key: dropped,
    // not left to be recovered against the wrong session.
    expect(api.activeKey()).toBeNull()
    expect(store.has(JOURNAL)).toBe(false)
  })

  it('lets the next attempt through when the failure was transient', async () => {
    stubKms()
    const api = keyStore({ commitFailsOnce: true })
    const { adapter } = storage()
    const core = await build({ api, adapter })
    await caught(core.auth(login))

    await core.auth(login)

    await expect(core.getSession()).resolves.toBeDefined()
  })
})

describe('session commit: the rotation happened but was not acknowledged', () => {
  it('completes the login instead of failing it', async () => {
    // Failing here would leave the caller believing it is logged out while
    // holding a key the backend has already accepted.
    stubKms()
    const api = keyStore({ commitPromotesThenFails: true })
    const { adapter, store } = storage()
    const core = await build({ api, adapter })

    await expect(core.auth(login)).resolves.toBeDefined()

    await expect(core.getSession()).resolves.toBeDefined()
    expect(api.activeKey()).toBe(sessionKey(1))
    expect(store.has(JOURNAL)).toBe(false)
  })
})

describe('session commit: a second key-store call fails inside the handler', () => {
  // Both handlers `await` further key-store calls before rethrowing, unguarded.
  // When one fails its error REPLACES the original, so the caller is told the
  // rollback failed rather than the commit.
  it.fails('still blames the commit when the rollback also fails', async () => {
    stubKms()
    const api = keyStore({ commitFails: true, discardFails: true })
    const { adapter } = storage()
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(error).not.toBe('RESOLVED')
    expect(blames(error, COMMIT_FAILURE)).toBe(true)
  })

  it.fails('still blames the commit when the key read also fails', async () => {
    stubKms()
    const api = keyStore({
      commitFails: true,
      readFailsAfterCommitFailure: true,
    })
    const { adapter } = storage()
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(error).not.toBe('RESOLVED')
    expect(blames(error, COMMIT_FAILURE)).toBe(true)
  })

  it('surfaces the substituted failure attributably at least', async () => {
    // Weaker than the invariant above, and true today: whichever error wins names
    // the key store, and no session is committed on the way out.
    stubKms()
    const api = keyStore({ commitFails: true, discardFails: true })
    const { adapter } = storage()
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(TypeError)
    expect(
      blames(error, DISCARD_FAILURE) || blames(error, COMMIT_FAILURE),
    ).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })
})

describe('session commit: storage fails around the journal', () => {
  it('fails before promoting the key when the journal cannot be staged', async () => {
    stubKms()
    const api = keyStore()
    const { adapter } = storage({ stageFails: true })
    const core = await build({ api, adapter })

    await expect(core.auth(login)).rejects.toThrow(/storage write failed/)

    // Staging runs first on purpose: an unwritable journal must stop the
    // rotation, not follow it.
    expect(api.activeKey()).toBeNull()
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('names the journal when it disappears between staging and commit', async () => {
    stubKms()
    const api = keyStore()
    const { adapter } = storage({ journalVanishes: true })
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(blames(error, 'journal')).toBe(true)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('reports a failing journal read rather than a silent half-login', async () => {
    stubKms()
    const api = keyStore()
    const { adapter } = storage({ journalReadFails: true })
    const core = await build({ api, adapter })

    const error = await caught(core.auth(login))

    expect(error).toBeInstanceOf(Error)
    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('prepares the fallback: the key IS promoted, so the journal stays recoverable', async () => {
    // Precondition for the crash-recovery test below: the rotation completed, so
    // the journal still matches the live key and must NOT be discarded.
    stubKms()
    const api = keyStore()
    const { adapter, store } = storage({ journalReadFails: true })
    const core = await build({ api, adapter })
    await caught(core.auth(login))

    expect(api.activeKey()).toBe(sessionKey(1))
    expect(store.has(JOURNAL)).toBe(true)
  })
})

describe('session commit: crash recovery on the next construction', () => {
  it('finishes an interrupted transition once storage works again', async () => {
    stubKms()
    const api = keyStore()
    const broken = storage({ journalReadFails: true })
    await caught((await build({ api, adapter: broken.adapter })).auth(login))
    expect(broken.store.has(JOURNAL)).toBe(true)

    const healed = storage({}, broken.store)
    const rebuilt = await build({ api, adapter: healed.adapter })

    await expect(rebuilt.getSession()).resolves.toBeDefined()
    expect(healed.store.has(JOURNAL)).toBe(false)
  })

  it('discards the journal when no key is held at all', async () => {
    stubKms()
    const api = keyStore()
    const broken = storage({ journalReadFails: true })
    await caught((await build({ api, adapter: broken.adapter })).auth(login))

    const healed = storage({}, broken.store)
    const rebuilt = await build({ api: keyStore(), adapter: healed.adapter })

    await expect(rebuilt.getSession()).resolves.toBeUndefined()
    expect(healed.store.has(JOURNAL)).toBe(false)
  })

  it('discards the journal when a DIFFERENT key is held', async () => {
    // Not a duplicate of the one above: that case short-circuits on the absent key
    // before any comparison runs. Two checks enforce this one, so deleting either
    // alone leaves it green — do not "fix" the surviving mutation.
    stubKms()
    const api = keyStore()
    const broken = storage({ journalReadFails: true })
    await caught((await build({ api, adapter: broken.adapter })).auth(login))

    const healed = storage({}, broken.store)
    const rebuilt = await build({
      api: keyStore({ holdingKey: 9 }),
      adapter: healed.adapter,
    })

    await expect(rebuilt.getSession()).resolves.toBeUndefined()
    expect(healed.store.has(JOURNAL)).toBe(false)
  })
})
