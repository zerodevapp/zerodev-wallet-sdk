/**
 * Boundary between Wallet Core and the two local stateful stores it must keep in
 * agreement: the key store (`ApiKeyStamper`) and session storage
 * (`StorageAdapter`).
 *
 * `createZeroDevWalletCore` reconciles them on EVERY construction, before the SDK
 * object is returned: it replays any staged transition, then compares the restored
 * session's bound public key against the live signing key and clears sessions if
 * they disagree. The two stores fail independently, through eviction, a partial
 * device restore or a rotation left half finished, so this decides whether a
 * returning user keeps their login or is silently signed out. Construction makes
 * no network call; the org id lookup is lazy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyStamper } from '../stampers/types.js'
import type { StorageAdapter } from '../storage/manager.js'
import { SessionType, type ZeroDevWalletSession } from '../types/session.js'
import { createZeroDevWalletCore } from './createZeroDevWalletCore.js'

const ACTIVE_SESSION_KEY = '@zerodev/active_session'
const ALL_SESSIONS_KEY = '@zerodev/sessions'
const SESSION_TRANSITION_KEY = '@zerodev/session_transition'

const KEY_LIVE =
  '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const KEY_OTHER =
  '02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

function sessionToken(publicKey: string): string {
  return `hdr.${btoa(
    JSON.stringify({
      exp: Date.now() + 3_600_000,
      public_key: publicKey,
      session_type: SessionType.READ_WRITE,
      user_id: 'user-1',
      organization_id: 'org-1',
    }),
  )}.sig`
}

function session(id: string, publicKey: string): ZeroDevWalletSession {
  return {
    id,
    userId: 'user-1',
    organizationId: 'org-1',
    stamperType: 'apiKey',
    sessionType: SessionType.READ_WRITE,
    token: sessionToken(publicKey),
    publicKey,
    expiry: Date.now() + 3_600_000,
    createdAt: Date.now(),
  }
}

/** Storage pre-seeded as if a previous run had stored `s` and made it active. */
function seededStore(s?: ZeroDevWalletSession): Map<string, string> {
  const store = new Map<string, string>()
  if (s) {
    store.set(s.id, JSON.stringify(s))
    store.set(ALL_SESSIONS_KEY, JSON.stringify([s.id]))
    store.set(ACTIVE_SESSION_KEY, s.id)
  }
  return store
}

function adapterOver(store: Map<string, string>): StorageAdapter {
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

/** Minimal ApiKeyStamper whose active key is fixed; no crypto, no network. */
function fakeStamper(activeKey: string | null): ApiKeyStamper {
  return {
    stamp: vi.fn(async () => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: 'stamp',
    })),
    clear: vi.fn(async () => {}),
    getPublicKey: vi.fn(async () => activeKey),
    resetKeyPair: vi.fn(async () => {}),
    prepareKeyRotation: vi.fn(async () => KEY_OTHER),
    stampPending: vi.fn(async () => ({
      stampHeaderName: 'X-Stamp',
      stampHeaderValue: 'stamp',
    })),
    signPending: vi.fn(async () => 'sig'),
    commitKeyRotation: vi.fn(async () => {}),
    discardKeyRotation: vi.fn(async () => {}),
    sign: vi.fn(async () => 'sig'),
  }
}

async function buildCore(store: Map<string, string>, activeKey: string | null) {
  return createZeroDevWalletCore({
    projectId: 'project-1',
    rpId: 'localhost',
    sessionStorage: adapterOver(store),
    apiKeyStamper: fakeStamper(activeKey),
    // A dead address on purpose: a construction-time request would fail loudly
    // here rather than silently reach real KMS.
    proxyBaseUrl: 'http://127.0.0.1:1/api/v1',
  })
}

describe('core reconciliation on construction: keys agree', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  // Load-bearing: without it the spy outlives this describe and wraps `fetch`
  // for every later test in the file.
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the stored session when its bound key matches the live signing key', async () => {
    const stored = session('session_live', KEY_LIVE)
    const store = seededStore(stored)

    const core = await buildCore(store, KEY_LIVE)

    await expect(core.getSession()).resolves.toMatchObject({
      id: 'session_live',
    })
    expect(store.get(ACTIVE_SESSION_KEY)).toBe('session_live')
    expect(JSON.parse(store.get(ALL_SESSIONS_KEY) as string)).toEqual([
      'session_live',
    ])
  })

  it('performs no network request while reconciling', async () => {
    const store = seededStore(session('session_live', KEY_LIVE))

    await buildCore(store, KEY_LIVE)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tolerates a case- and 0x-prefix difference between the two stores', async () => {
    // Same key, handed to the stamper 0x-prefixed and upper-cased — as a
    // different component writing the other store may well produce.
    const stored = session('session_live', KEY_LIVE)
    const store = seededStore(stored)

    const core = await buildCore(store, `0x${KEY_LIVE.toUpperCase()}`)

    await expect(core.getSession()).resolves.toMatchObject({
      id: 'session_live',
    })
  })
})

describe('core reconciliation on construction: stores disagree', () => {
  it('clears sessions when the stored session is bound to a different key', async () => {
    const store = seededStore(session('session_stale', KEY_OTHER))

    const core = await buildCore(store, KEY_LIVE)

    await expect(core.getSession()).resolves.toBeUndefined()
    expect(store.get(ACTIVE_SESSION_KEY)).toBeUndefined()
  })

  it('clears sessions when the stored token cannot be parsed', async () => {
    const stored = session('session_corrupt', KEY_LIVE)
    const store = seededStore({ ...stored, token: 'not-a-jwt' })

    const core = await buildCore(store, KEY_LIVE)

    await expect(core.getSession()).resolves.toBeUndefined()
  })

  it('does not throw when there is no live key and no session', async () => {
    const store = new Map<string, string>()

    const core = await buildCore(store, null)

    await expect(core.getSession()).resolves.toBeUndefined()
  })
})

describe('core reconciliation on construction: crashed transition', () => {
  it('replays a staged transition whose key matches the live key', async () => {
    // A journal staged and then abandoned mid-commit, with the key rotation
    // itself having landed — so the staged session matches the live key.
    const store = new Map<string, string>()
    store.set(
      SESSION_TRANSITION_KEY,
      JSON.stringify({
        sessionData: session('session_staged', KEY_LIVE),
        publicKey: KEY_LIVE,
      }),
    )

    const core = await buildCore(store, KEY_LIVE)

    await expect(core.getSession()).resolves.toMatchObject({
      id: 'session_staged',
    })
    expect(store.get(SESSION_TRANSITION_KEY)).toBeUndefined()
  })

  it('discards a staged transition for a key that never became live, keeping the old session', async () => {
    // A journal naming a key the device never ended up holding, on top of a
    // still-valid session.
    const store = seededStore(session('session_live', KEY_LIVE))
    store.set(
      SESSION_TRANSITION_KEY,
      JSON.stringify({
        sessionData: session('session_staged', KEY_OTHER),
        publicKey: KEY_OTHER,
      }),
    )

    const core = await buildCore(store, KEY_LIVE)

    await expect(core.getSession()).resolves.toMatchObject({
      id: 'session_live',
    })
    expect(store.get(SESSION_TRANSITION_KEY)).toBeUndefined()
  })
})
