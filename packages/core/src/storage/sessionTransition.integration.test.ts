/**
 * Boundary between Wallet Core and session storage.
 *
 * The storage adapter is injected and external, IndexedDB on web or
 * expo-secure-store and AsyncStorage on native, so it can fail while writing, be
 * evicted, or come back from a device restore holding stale data.
 *
 * The contract: a staged transition is applied ONLY when the live signing key
 * matches the key it was staged for. Every other case discards the journal and
 * leaves existing state alone.
 *
 * `mem.store` is read directly in places. That is the record of what the manager
 * wrote, not a fact about the double, which is a bare `Map`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionType, type ZeroDevWalletSession } from '../types/session.js'
import { createStorageManager, type StorageAdapter } from './manager.js'

const ACTIVE_SESSION_KEY = '@zerodev/active_session'
const ALL_SESSIONS_KEY = '@zerodev/sessions'
const SESSION_TRANSITION_KEY = '@zerodev/session_transition'

const KEY_A =
  '02aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const KEY_B =
  '02bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

/** A token `parseSession` accepts: 3 parts, future `exp`, all required claims. */
function sessionToken(publicKey: string, userId = 'user-1'): string {
  const payload = {
    exp: Date.now() + 3_600_000,
    public_key: publicKey,
    session_type: SessionType.READ_WRITE,
    user_id: userId,
    organization_id: 'org-1',
  }
  return `hdr.${btoa(JSON.stringify(payload))}.sig`
}

function session(
  id: string,
  publicKey: string,
  userId = 'user-1',
): ZeroDevWalletSession {
  return {
    id,
    userId,
    organizationId: 'org-1',
    stamperType: 'apiKey',
    sessionType: SessionType.READ_WRITE,
    token: sessionToken(publicKey, userId),
    publicKey,
    expiry: Date.now() + 3_600_000,
    createdAt: Date.now(),
  }
}

/** In-memory adapter with a seam for making one specific write fail. */
function memoryAdapter(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  let failWrite: ((key: string) => boolean) | undefined
  const adapter: StorageAdapter = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrite?.(key)) throw new Error(`storage write failed: ${key}`)
      store.set(key, value)
    },
    removeItem: (key) => {
      store.delete(key)
    },
  }
  return {
    adapter,
    store,
    failWritesTo(predicate: (key: string) => boolean) {
      failWrite = predicate
    },
    stopFailing() {
      failWrite = undefined
    },
  }
}

describe('session storage boundary: transition journal', () => {
  let mem: ReturnType<typeof memoryAdapter>
  let manager: ReturnType<typeof createStorageManager>

  beforeEach(() => {
    mem = memoryAdapter()
    manager = createStorageManager(mem.adapter)
  })

  it('applies a staged transition when the live key matches the staged key', async () => {
    const next = session('session_new', KEY_A)
    await manager.stageSessionTransition(next, KEY_A)

    const recovered = await manager.recoverSessionTransition(KEY_A)

    expect(recovered?.id).toBe('session_new')
    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_new',
    })
    expect(await manager.getActiveSessionKey()).toBe('session_new')
    expect(mem.store.has(SESSION_TRANSITION_KEY)).toBe(false)
  })

  it('discards the journal and preserves the existing session when the live key does not match', async () => {
    const existing = session('session_existing', KEY_A)
    await manager.storeSession(existing, existing.id)
    const staged = session('session_staged', KEY_B)
    await manager.stageSessionTransition(staged, KEY_B)

    // Recover with live key A against a transition staged for B — a rotation
    // that never completed.
    const recovered = await manager.recoverSessionTransition(KEY_A)

    expect(recovered).toBeUndefined()
    expect(mem.store.has(SESSION_TRANSITION_KEY)).toBe(false)
    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_existing',
    })
  })

  it('discards the journal when there is no live key at all', async () => {
    const staged = session('session_staged', KEY_B)
    await manager.stageSessionTransition(staged, KEY_B)

    const recovered = await manager.recoverSessionTransition(null)

    expect(recovered).toBeUndefined()
    expect(mem.store.has(SESSION_TRANSITION_KEY)).toBe(false)
    await expect(manager.getActiveSession()).resolves.toBeUndefined()
  })

  it('is a no-op when there is no journal, and leaves the active session intact', async () => {
    const existing = session('session_existing', KEY_A)
    await manager.storeSession(existing, existing.id)

    await expect(
      manager.recoverSessionTransition(KEY_A),
    ).resolves.toBeUndefined()

    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_existing',
    })
  })

  it('treats a corrupt journal as absent rather than throwing', async () => {
    // Garbage written straight into the store, as a truncated write or a
    // half-synced backup would leave it.
    const existing = session('session_existing', KEY_A)
    await manager.storeSession(existing, existing.id)
    mem.store.set(SESSION_TRANSITION_KEY, '{not json')

    await expect(
      manager.recoverSessionTransition(KEY_A),
    ).resolves.toBeUndefined()

    expect(mem.store.has(SESSION_TRANSITION_KEY)).toBe(false)
    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_existing',
    })
  })

  it('does not activate a staged session whose stored shape is invalid', async () => {
    const existing = session('session_existing', KEY_A)
    await manager.storeSession(existing, existing.id)
    mem.store.set(
      SESSION_TRANSITION_KEY,
      JSON.stringify({
        sessionData: { id: 'bogus', userId: 'user-1' },
        publicKey: KEY_A,
      }),
    )

    await expect(
      manager.recoverSessionTransition(KEY_A),
    ).resolves.toBeUndefined()

    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_existing',
    })
  })

  it('commitSessionTransition replaces every prior session, not just the pointer', async () => {
    const old = session('session_old', KEY_A)
    await manager.storeSession(old, old.id)
    const next = session('session_new', KEY_B)
    await manager.stageSessionTransition(next, KEY_B)

    await manager.commitSessionTransition()

    const keys = await manager.listSessionKeys()
    expect(keys).toEqual(['session_new'])
    await expect(manager.getSession('session_old')).resolves.toBeUndefined()
  })
})

describe('session storage boundary: partial write failure', () => {
  it('rolls the session index back when the active-pointer write fails', async () => {
    // Forces the LAST of the three writes (record, index, active pointer) to
    // throw, so the first two have already landed when it fails.
    const mem = memoryAdapter()
    const manager = createStorageManager(mem.adapter)
    const existing = session('session_existing', KEY_A)
    await manager.storeSession(existing, existing.id)

    const before = new Map(mem.store)
    const next = session('session_new', KEY_B)
    mem.failWritesTo((key) => key === ACTIVE_SESSION_KEY)

    await expect(manager.storeSession(next, next.id)).rejects.toThrow(
      /storage write failed/,
    )
    mem.stopFailing()

    expect(mem.store.get(ALL_SESSIONS_KEY)).toBe(before.get(ALL_SESSIONS_KEY))
    expect(mem.store.get(ACTIVE_SESSION_KEY)).toBe(
      before.get(ACTIVE_SESSION_KEY),
    )
    await expect(manager.getActiveSession()).resolves.toMatchObject({
      id: 'session_existing',
    })
  })

  it('does not report a usable session when the storage read fails', async () => {
    // Every read throws. Loose on purpose: "propagate" vs "resolve to no
    // session" is an unanswered product question, so do NOT tighten this to
    // `.rejects` — that would pin current behaviour as the contract.
    const mem = memoryAdapter()
    const failing: StorageAdapter = {
      ...mem.adapter,
      getItem: vi.fn(() => {
        throw new Error('IndexedDB unavailable')
      }),
    }
    const manager = createStorageManager(failing)

    const outcome = await manager
      .getActiveSession()
      .then((session) => ({ ok: true as const, session }))
      .catch((error: unknown) => ({ ok: false as const, error }))

    if (outcome.ok) {
      expect(outcome.session).toBeUndefined()
    } else {
      expect(outcome.error).toBeInstanceOf(Error)
    }
  })
})
