import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ZeroDevWalletSession } from '../types/session.js'
import { createStorageManager, type StorageAdapter } from './manager.js'

// Create a mock in-memory storage adapter
function createMockAdapter() {
  const store = new Map<string, string>()
  return {
    store,
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
  } satisfies StorageAdapter & { store: Map<string, string> }
}

// Helper to create a valid session
function createSession(
  overrides: Partial<ZeroDevWalletSession> = {},
): ZeroDevWalletSession {
  return {
    id: `session-${Math.random().toString(36).slice(2)}`,
    userId: 'user-123',
    organizationId: 'org-456',
    stamperType: 'apiKey',
    token: 'mock-token',
    expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now (in seconds)
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('createStorageManager', () => {
  let adapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    adapter = createMockAdapter()
  })

  describe('storeSession', () => {
    it('stores session data under the given key', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession({ id: 'test-session' })
      const sessionKey = 'session:test@example.com'

      await manager.storeSession(session, sessionKey)

      expect(adapter.setItem).toHaveBeenCalledWith(
        sessionKey,
        JSON.stringify(session),
      )
    })

    it('adds session key to the sessions list', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:user1'

      await manager.storeSession(session, sessionKey)

      const sessionsList = JSON.parse(
        adapter.store.get('@zerodev/sessions') || '[]',
      )
      expect(sessionsList).toContain(sessionKey)
    })

    it('does not duplicate session key in list', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession({ id: 'session-1' })
      const session2 = createSession({ id: 'session-2' })
      const sessionKey = 'session:user1'

      await manager.storeSession(session1, sessionKey)
      await manager.storeSession(session2, sessionKey) // Same key, different session

      const sessionsList = JSON.parse(
        adapter.store.get('@zerodev/sessions') || '[]',
      )
      expect(sessionsList.filter((k: string) => k === sessionKey).length).toBe(
        1,
      )
    })

    it('sets the session as active', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:active-user'

      await manager.storeSession(session, sessionKey)

      expect(adapter.store.get('@zerodev/active_session')).toBe(sessionKey)
    })

    it('rolls back the session record when indexing it fails', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:partial-write'
      adapter.setItem.mockImplementation((key: string, value: string) => {
        if (key === '@zerodev/sessions') throw new Error('storage failed')
        adapter.store.set(key, value)
      })

      await expect(manager.storeSession(session, sessionKey)).rejects.toThrow(
        'storage failed',
      )

      expect(adapter.store.has(sessionKey)).toBe(false)
    })

    it.each([
      ['session record', 'session:new'],
      ['session index', '@zerodev/sessions'],
      ['active pointer', '@zerodev/active_session'],
    ])(
      'restores the complete old state when the %s write fails',
      async (_, failureKey) => {
        const manager = createStorageManager(adapter)
        const oldSession = createSession({ id: 'session:old' })
        const newSession = createSession({ id: 'session:new' })
        await manager.storeSession(oldSession, oldSession.id)
        const oldIndex = adapter.store.get('@zerodev/sessions')
        const oldActive = adapter.store.get('@zerodev/active_session')
        let failed = false
        adapter.setItem.mockImplementation((key: string, value: string) => {
          if (!failed && key === failureKey) {
            failed = true
            throw new Error(`failed ${failureKey}`)
          }
          adapter.store.set(key, value)
        })

        await expect(
          manager.storeSession(newSession, newSession.id),
        ).rejects.toThrow(`failed ${failureKey}`)

        expect(adapter.store.get(oldSession.id)).toBe(
          JSON.stringify(oldSession),
        )
        expect(adapter.store.get('@zerodev/sessions')).toBe(oldIndex)
        expect(adapter.store.get('@zerodev/active_session')).toBe(oldActive)
        expect(adapter.store.has(newSession.id)).toBe(false)
      },
    )

    it('does not lose sessions stored concurrently', async () => {
      const concurrentAdapter: StorageAdapter = {
        getItem: vi.fn(async (key: string) => {
          if (key === '@zerodev/sessions') {
            const snapshot = adapter.store.get(key) ?? null
            await Promise.resolve()
            return snapshot
          }
          return adapter.store.get(key) ?? null
        }),
        setItem: vi.fn(async (key: string, value: string) => {
          adapter.store.set(key, value)
        }),
        removeItem: vi.fn(async (key: string) => {
          adapter.store.delete(key)
        }),
      }
      const manager = createStorageManager(concurrentAdapter)

      await Promise.all([
        manager.storeSession(createSession(), 'session:a'),
        manager.storeSession(createSession(), 'session:b'),
      ])

      await expect(manager.listSessionKeys()).resolves.toEqual([
        'session:a',
        'session:b',
      ])
    })
  })

  describe('getActiveSession', () => {
    it('returns the active session', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession({ id: 'active-session' })
      const sessionKey = 'session:active'

      await manager.storeSession(session, sessionKey)
      const result = await manager.getActiveSession()

      expect(result).toEqual(session)
    })

    it('returns undefined when no active session', async () => {
      const manager = createStorageManager(adapter)

      const result = await manager.getActiveSession()

      expect(result).toBeUndefined()
    })

    it('returns undefined when active session key points to nothing', async () => {
      const manager = createStorageManager(adapter)
      adapter.store.set('@zerodev/active_session', 'nonexistent-key')

      const result = await manager.getActiveSession()

      expect(result).toBeUndefined()
    })

    it('returns undefined when active session is expired', async () => {
      const manager = createStorageManager(adapter)
      const expiredSession = createSession({
        expiry: Math.floor(Date.now() / 1000) - 3600,
      })
      const sessionKey = 'session:expired-active'

      adapter.store.set(sessionKey, JSON.stringify(expiredSession))
      adapter.store.set('@zerodev/sessions', JSON.stringify([sessionKey]))
      adapter.store.set('@zerodev/active_session', sessionKey)

      const result = await manager.getActiveSession()

      expect(result).toBeUndefined()
      // The expired session data should be cleaned up
      expect(adapter.store.has(sessionKey)).toBe(false)
    })
  })

  describe('getActiveSessionKey', () => {
    it('returns the active session key', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:user1'

      await manager.storeSession(session, sessionKey)
      const result = await manager.getActiveSessionKey()

      expect(result).toBe(sessionKey)
    })

    it('returns undefined when no active session', async () => {
      const manager = createStorageManager(adapter)

      const result = await manager.getActiveSessionKey()

      expect(result).toBeUndefined()
    })
  })

  describe('getSession', () => {
    it('returns session by key', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession({ id: 'specific-session' })
      const sessionKey = 'session:specific'

      await manager.storeSession(session, sessionKey)
      const result = await manager.getSession(sessionKey)

      expect(result).toEqual(session)
    })

    it('returns undefined for non-existent session', async () => {
      const manager = createStorageManager(adapter)

      const result = await manager.getSession('nonexistent')

      expect(result).toBeUndefined()
    })

    it('clears and returns undefined for expired session', async () => {
      const manager = createStorageManager(adapter)
      const expiredSession = createSession({
        expiry: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (in seconds)
      })
      const sessionKey = 'session:expired'

      // Store directly to bypass any validation
      adapter.store.set(sessionKey, JSON.stringify(expiredSession))
      adapter.store.set('@zerodev/sessions', JSON.stringify([sessionKey]))

      const result = await manager.getSession(sessionKey)

      expect(result).toBeUndefined()
      expect(adapter.store.has(sessionKey)).toBe(false)
    })

    it('clears and returns undefined when expiry is zero', async () => {
      const manager = createStorageManager(adapter)
      const sessionWithZeroExpiry = createSession({ expiry: 0 })
      const sessionKey = 'session:zero-expiry'

      adapter.store.set(sessionKey, JSON.stringify(sessionWithZeroExpiry))
      adapter.store.set('@zerodev/sessions', JSON.stringify([sessionKey]))

      const result = await manager.getSession(sessionKey)

      expect(result).toBeUndefined()
      expect(adapter.store.has(sessionKey)).toBe(false)
    })

    it('clears and returns undefined for malformed JSON', async () => {
      const manager = createStorageManager(adapter)
      const sessionKey = 'session:malformed'

      adapter.store.set(sessionKey, 'not-valid-json')
      adapter.store.set('@zerodev/sessions', JSON.stringify([sessionKey]))

      const result = await manager.getSession(sessionKey)

      expect(result).toBeUndefined()
      expect(adapter.store.has(sessionKey)).toBe(false)
    })

    it('clears and returns undefined for a structurally invalid session', async () => {
      const manager = createStorageManager(adapter)
      const sessionKey = 'session:invalid-shape'

      adapter.store.set(sessionKey, '{}')
      adapter.store.set('@zerodev/sessions', JSON.stringify([sessionKey]))

      const result = await manager.getSession(sessionKey)

      expect(result).toBeUndefined()
      expect(adapter.store.has(sessionKey)).toBe(false)
    })
  })

  describe('listSessionKeys', () => {
    it('returns all stored session keys', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession()
      const session2 = createSession()

      await manager.storeSession(session1, 'session:user1')
      await manager.storeSession(session2, 'session:user2')

      const keys = await manager.listSessionKeys()

      expect(keys).toContain('session:user1')
      expect(keys).toContain('session:user2')
      expect(keys.length).toBe(2)
    })

    it('returns empty array when no sessions', async () => {
      const manager = createStorageManager(adapter)

      const keys = await manager.listSessionKeys()

      expect(keys).toEqual([])
    })

    it('recovers safely when the session index is corrupted', async () => {
      const manager = createStorageManager(adapter)
      adapter.store.set('@zerodev/sessions', 'not-json')

      await expect(manager.listSessionKeys()).resolves.toEqual([])
    })

    it('removes keys that have no corresponding session data', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()

      await manager.storeSession(session, 'session:valid')
      // Manually add a key without session data
      const existingKeys = JSON.parse(
        adapter.store.get('@zerodev/sessions') || '[]',
      )
      existingKeys.push('session:orphan')
      adapter.store.set('@zerodev/sessions', JSON.stringify(existingKeys))

      const keys = await manager.listSessionKeys()

      expect(keys).toContain('session:valid')
      expect(keys).not.toContain('session:orphan')
    })
  })

  describe('listSessions', () => {
    it('returns all valid sessions', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession({ id: 'session-1' })
      const session2 = createSession({ id: 'session-2' })

      await manager.storeSession(session1, 'session:user1')
      await manager.storeSession(session2, 'session:user2')

      const sessions = await manager.listSessions()

      expect(sessions.length).toBe(2)
      expect(sessions.map((s) => s.id)).toContain('session-1')
      expect(sessions.map((s) => s.id)).toContain('session-2')
    })

    it('filters out expired sessions', async () => {
      const manager = createStorageManager(adapter)
      const validSession = createSession({ id: 'valid' })
      const expiredSession = createSession({
        id: 'expired',
        expiry: Math.floor(Date.now() / 1000) - 3600,
      })

      await manager.storeSession(validSession, 'session:valid')
      // Manually store expired session
      adapter.store.set('session:expired', JSON.stringify(expiredSession))
      const keys = JSON.parse(adapter.store.get('@zerodev/sessions') || '[]')
      keys.push('session:expired')
      adapter.store.set('@zerodev/sessions', JSON.stringify(keys))

      const sessions = await manager.listSessions()

      expect(sessions.length).toBe(1)
      expect(sessions[0]?.id).toBe('valid')
    })
  })

  describe('setActiveSession', () => {
    it('sets active session to existing session', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession({ id: 'session-1' })
      const session2 = createSession({ id: 'session-2' })

      await manager.storeSession(session1, 'session:user1')
      await manager.storeSession(session2, 'session:user2')

      // session:user2 is active after storing
      await manager.setActiveSession('session:user1')

      const activeKey = await manager.getActiveSessionKey()
      expect(activeKey).toBe('session:user1')
    })

    it('throws when session does not exist', async () => {
      const manager = createStorageManager(adapter)

      await expect(manager.setActiveSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      )
    })

    it('throws when session is expired', async () => {
      const manager = createStorageManager(adapter)
      const expiredSession = createSession({
        expiry: Math.floor(Date.now() / 1000) - 3600,
      })
      adapter.store.set('session:expired', JSON.stringify(expiredSession))
      adapter.store.set(
        '@zerodev/sessions',
        JSON.stringify(['session:expired']),
      )

      await expect(manager.setActiveSession('session:expired')).rejects.toThrow(
        'Session not found: session:expired',
      )
    })
  })

  describe('clearSession', () => {
    it('removes session data', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:to-clear'

      await manager.storeSession(session, sessionKey)
      await manager.clearSession(sessionKey)

      expect(adapter.store.has(sessionKey)).toBe(false)
    })

    it('removes session from keys list', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:to-clear'

      await manager.storeSession(session, sessionKey)
      await manager.clearSession(sessionKey)

      const keys = await manager.listSessionKeys()
      expect(keys).not.toContain(sessionKey)
    })

    it('clears active session if it was the cleared one', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()
      const sessionKey = 'session:active-to-clear'

      await manager.storeSession(session, sessionKey)
      // Session is automatically set as active
      await manager.clearSession(sessionKey)

      const activeKey = await manager.getActiveSessionKey()
      expect(activeKey).toBeUndefined()
    })

    it('handles clearing a nonexistent session key gracefully', async () => {
      const manager = createStorageManager(adapter)

      // Should not throw when clearing a key that was never stored
      await manager.clearSession('session:never-existed')

      const keys = await manager.listSessionKeys()
      expect(keys).toEqual([])
    })

    it('does not affect active session if clearing different session', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession()
      const session2 = createSession()

      await manager.storeSession(session1, 'session:1')
      await manager.storeSession(session2, 'session:2') // This becomes active
      await manager.clearSession('session:1')

      const activeKey = await manager.getActiveSessionKey()
      expect(activeKey).toBe('session:2')
    })
  })

  describe('clearAllSessions', () => {
    it('removes all session data', async () => {
      const manager = createStorageManager(adapter)
      const session1 = createSession()
      const session2 = createSession()

      await manager.storeSession(session1, 'session:1')
      await manager.storeSession(session2, 'session:2')
      await manager.clearAllSessions()

      expect(adapter.store.has('session:1')).toBe(false)
      expect(adapter.store.has('session:2')).toBe(false)
    })

    it('clears sessions list', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()

      await manager.storeSession(session, 'session:1')
      await manager.clearAllSessions()

      expect(adapter.store.has('@zerodev/sessions')).toBe(false)
    })

    it('clears active session', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession()

      await manager.storeSession(session, 'session:1')
      await manager.clearAllSessions()

      expect(adapter.store.has('@zerodev/active_session')).toBe(false)
    })

    it('clears a staged transition containing a replacement bearer token', async () => {
      const manager = createStorageManager(adapter)
      const session = createSession({ token: 'replacement-bearer-token' })
      await manager.stageSessionTransition(session, 'pending-key')

      await manager.clearAllSessions()

      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    })

    it('handles empty state gracefully', async () => {
      const manager = createStorageManager(adapter)

      await expect(manager.clearAllSessions()).resolves.toBeUndefined()
    })
  })

  describe('session transition recovery', () => {
    it('stages a replacement without changing the active session', async () => {
      const manager = createStorageManager(adapter)
      const oldSession = createSession({ id: 'old-session' })
      const newSession = createSession({ id: 'new-session' })
      await manager.storeSession(oldSession, oldSession.id)

      await manager.stageSessionTransition(newSession, 'new-public-key')

      await expect(manager.getActiveSession()).resolves.toEqual(oldSession)
      expect(adapter.store.has('@zerodev/session_transition')).toBe(true)
    })

    it('finishes a staged transition when the persisted key was committed', async () => {
      const manager = createStorageManager(adapter)
      const oldSession = createSession({ id: 'old-session' })
      const newSession = createSession({ id: 'new-session' })
      await manager.storeSession(oldSession, oldSession.id)
      await manager.stageSessionTransition(newSession, '0xNEW-PUBLIC-KEY')

      const recovered = await manager.recoverSessionTransition('new-public-key')

      expect(recovered).toEqual(newSession)
      await expect(manager.getActiveSession()).resolves.toEqual(newSession)
      expect(await manager.listSessionKeys()).toEqual([newSession.id])
      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    })

    it('discards an uncommitted transition and preserves the old session', async () => {
      const manager = createStorageManager(adapter)
      const oldSession = createSession({ id: 'old-session' })
      const newSession = createSession({ id: 'new-session' })
      await manager.storeSession(oldSession, oldSession.id)
      await manager.stageSessionTransition(newSession, 'new-public-key')

      await manager.recoverSessionTransition('old-public-key')

      await expect(manager.getActiveSession()).resolves.toEqual(oldSession)
      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    })

    it('discards a staged transition when no active local key exists', async () => {
      const manager = createStorageManager(adapter)
      const newSession = createSession({ id: 'new-session' })
      await manager.stageSessionTransition(newSession, 'new-public-key')

      await manager.recoverSessionTransition(null)

      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    })

    it('retains the journal when final session persistence fails', async () => {
      const manager = createStorageManager(adapter)
      const newSession = createSession({ id: 'new-session' })
      await manager.stageSessionTransition(newSession, 'new-public-key')
      adapter.setItem.mockImplementation((key: string, value: string) => {
        if (key === newSession.id) throw new Error('storage failed')
        adapter.store.set(key, value)
      })

      await expect(manager.commitSessionTransition()).rejects.toThrow(
        'storage failed',
      )

      expect(adapter.store.has('@zerodev/session_transition')).toBe(true)
    })

    it('rejects a structurally tampered transition instead of committing it', async () => {
      const manager = createStorageManager(adapter)
      const oldSession = createSession({ id: 'old-session' })
      const newSession = createSession({ id: 'new-session' })
      await manager.storeSession(oldSession, oldSession.id)
      await manager.stageSessionTransition(newSession, 'new-public-key')
      adapter.store.set(
        '@zerodev/session_transition',
        JSON.stringify({
          sessionData: { ...newSession, token: '' },
          publicKey: 'new-public-key',
        }),
      )

      await expect(
        manager.recoverSessionTransition('new-public-key'),
      ).resolves.toBeUndefined()

      await expect(manager.getActiveSession()).resolves.toEqual(oldSession)
      expect(adapter.store.has('@zerodev/session_transition')).toBe(false)
    })
  })

  describe('async adapter support', () => {
    it('works with async adapter methods', async () => {
      const asyncAdapter: StorageAdapter = {
        getItem: vi.fn(async (key: string) => {
          await new Promise((r) => setTimeout(r, 1))
          return adapter.store.get(key) ?? null
        }),
        setItem: vi.fn(async (key: string, value: string) => {
          await new Promise((r) => setTimeout(r, 1))
          adapter.store.set(key, value)
        }),
        removeItem: vi.fn(async (key: string) => {
          await new Promise((r) => setTimeout(r, 1))
          adapter.store.delete(key)
        }),
      }

      const manager = createStorageManager(asyncAdapter)
      const session = createSession()

      await manager.storeSession(session, 'session:async')
      const result = await manager.getSession('session:async')

      expect(result).toEqual(session)
    })
  })
})
