import type { ZeroDevWalletSession } from '../types/session.js'
import { normalizeTimestamp } from '../utils/utils.js'

export type StorageAdapter = {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export type StorageManager = {
  storeSession(
    sessionData: ZeroDevWalletSession,
    sessionKey: string,
  ): Promise<void>
  getActiveSession(): Promise<ZeroDevWalletSession | undefined>
  getActiveSessionKey(): Promise<string | undefined>
  getSession(sessionKey: string): Promise<ZeroDevWalletSession | undefined>
  listSessionKeys(): Promise<string[]>
  listSessions(): Promise<ZeroDevWalletSession[]>
  setActiveSession(sessionKey: string): Promise<void>
  clearSession(sessionKey: string): Promise<void>
  clearAllSessions(): Promise<void>
  stageSessionTransition(
    sessionData: ZeroDevWalletSession,
    publicKey: string,
  ): Promise<void>
  commitSessionTransition(): Promise<ZeroDevWalletSession | undefined>
  recoverSessionTransition(
    activePublicKey: string | null,
  ): Promise<ZeroDevWalletSession | undefined>
}

type SessionTransition = {
  sessionData: ZeroDevWalletSession
  publicKey: string
}

let mutationTail = Promise.resolve()

function isStoredSession(value: unknown): value is ZeroDevWalletSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<ZeroDevWalletSession>
  return (
    typeof session.id === 'string' &&
    typeof session.userId === 'string' &&
    typeof session.organizationId === 'string' &&
    (session.stamperType === 'apiKey' || session.stamperType === 'passkey') &&
    typeof session.token === 'string' &&
    session.token.length > 0 &&
    typeof session.expiry === 'number' &&
    Number.isFinite(session.expiry) &&
    session.expiry > 0 &&
    typeof session.createdAt === 'number' &&
    Number.isFinite(session.createdAt)
  )
}

export function createStorageManager(adapter: StorageAdapter): StorageManager {
  const ACTIVE_SESSION_KEY = '@zerodev/active_session'
  const ALL_SESSIONS_KEY = '@zerodev/sessions'
  const SESSION_TRANSITION_KEY = '@zerodev/session_transition'

  const withMutation = async <T>(mutation: () => Promise<T>): Promise<T> => {
    const result = mutationTail.then(mutation)
    mutationTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const parseSessionKeys = (value: string | null): string[] | undefined => {
    if (!value) return []
    try {
      const parsed: unknown = JSON.parse(value)
      if (
        !Array.isArray(parsed) ||
        !parsed.every((key): key is string => typeof key === 'string')
      ) {
        return undefined
      }
      return parsed
    } catch {
      return undefined
    }
  }

  const restoreItem = async (key: string, value: string | null) => {
    if (value === null) await adapter.removeItem(key)
    else await adapter.setItem(key, value)
  }

  const storeSessionUnlocked = async (
    sessionData: ZeroDevWalletSession,
    sessionKey: string,
  ): Promise<void> => {
    const recordKey = sessionKey
    const [previousRecord, previousIndex, previousActive] = await Promise.all([
      adapter.getItem(recordKey),
      adapter.getItem(ALL_SESSIONS_KEY),
      adapter.getItem(ACTIVE_SESSION_KEY),
    ])
    try {
      await adapter.setItem(recordKey, JSON.stringify(sessionData))
      const sessions = parseSessionKeys(previousIndex) ?? []
      if (!sessions.includes(sessionKey)) sessions.push(sessionKey)
      await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(sessions))
      await adapter.setItem(ACTIVE_SESSION_KEY, sessionKey)
    } catch (error) {
      await Promise.allSettled([
        restoreItem(recordKey, previousRecord),
        restoreItem(ALL_SESSIONS_KEY, previousIndex),
        restoreItem(ACTIVE_SESSION_KEY, previousActive),
      ])
      throw error
    }
  }

  const storeSession = async (
    sessionData: ZeroDevWalletSession,
    sessionKey: string,
  ): Promise<void> =>
    withMutation(() => storeSessionUnlocked(sessionData, sessionKey))

  const getActiveSession = async (): Promise<
    ZeroDevWalletSession | undefined
  > => {
    const activeKey = await adapter.getItem(ACTIVE_SESSION_KEY)
    if (!activeKey) return undefined

    return getSession(activeKey)
  }

  const getActiveSessionKey = async (): Promise<string | undefined> => {
    const key = await adapter.getItem(ACTIVE_SESSION_KEY)
    return key || undefined
  }

  const getSession = async (
    sessionKey: string,
  ): Promise<ZeroDevWalletSession | undefined> => {
    const sessionStr = await adapter.getItem(sessionKey)
    if (!sessionStr) return undefined

    try {
      const session: unknown = JSON.parse(sessionStr)
      if (!isStoredSession(session)) {
        await clearSession(sessionKey)
        return undefined
      }

      // Check if session is expired
      if (normalizeTimestamp(session.expiry) < Date.now()) {
        await clearSession(sessionKey)
        return undefined
      }

      return session
    } catch (_error) {
      // Invalid JSON, clean up
      await clearSession(sessionKey)
      return undefined
    }
  }

  const listSessionKeysUnlocked = async (): Promise<string[]> => {
    const sessionsStr = await adapter.getItem(ALL_SESSIONS_KEY)
    const parsedKeys = parseSessionKeys(sessionsStr)
    if (!parsedKeys) {
      await adapter.removeItem(ALL_SESSIONS_KEY)
      return []
    }

    // Clean up any keys that don't have corresponding sessions
    const validKeys: string[] = []
    for (const key of parsedKeys) {
      const exists = await adapter.getItem(key)
      if (exists) {
        validKeys.push(key)
      }
    }

    // Update the list if we found invalid keys
    if (validKeys.length !== parsedKeys.length) {
      await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(validKeys))
    }

    return validKeys
  }

  const listSessionKeys = async (): Promise<string[]> =>
    withMutation(listSessionKeysUnlocked)

  const listSessions = async (): Promise<ZeroDevWalletSession[]> => {
    const sessionKeys = await listSessionKeys()
    const sessions: ZeroDevWalletSession[] = []

    for (const key of sessionKeys) {
      const session = await getSession(key)
      if (session) {
        sessions.push(session)
      }
    }

    return sessions
  }

  const setActiveSession = async (sessionKey: string): Promise<void> => {
    // Verify the session exists
    const session = await getSession(sessionKey)
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`)
    }

    await withMutation(async () => {
      await adapter.setItem(ACTIVE_SESSION_KEY, sessionKey)
    })
  }

  const clearSessionUnlocked = async (sessionKey: string): Promise<void> => {
    // Remove the session data
    await adapter.removeItem(sessionKey)

    // Remove from sessions list
    const sessions = await listSessionKeysUnlocked()
    const updated = sessions.filter((k) => k !== sessionKey)
    await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(updated))

    // Clear active session if it was the cleared one
    const activeKey = await adapter.getItem(ACTIVE_SESSION_KEY)
    if (activeKey === sessionKey) {
      await adapter.removeItem(ACTIVE_SESSION_KEY)
    }
  }

  const clearSession = async (sessionKey: string): Promise<void> =>
    withMutation(() => clearSessionUnlocked(sessionKey))

  const clearAllSessions = async (): Promise<void> =>
    withMutation(async () => {
      await clearAllSessionsUnlocked()
      await adapter.removeItem(SESSION_TRANSITION_KEY)
    })

  async function clearAllSessionsUnlocked(): Promise<void> {
    const sessions = await listSessionKeysUnlocked()

    for (const key of sessions) {
      await adapter.removeItem(key)
    }

    await adapter.removeItem(ALL_SESSIONS_KEY)
    await adapter.removeItem(ACTIVE_SESSION_KEY)
  }

  const parseTransition = (value: string | null): SessionTransition | null => {
    if (!value) return null
    try {
      const parsed = JSON.parse(value) as Partial<SessionTransition>
      if (
        !isStoredSession(parsed.sessionData) ||
        typeof parsed.publicKey !== 'string' ||
        !parsed.publicKey
      ) {
        return null
      }
      return parsed as SessionTransition
    } catch {
      return null
    }
  }

  const stageSessionTransition = async (
    sessionData: ZeroDevWalletSession,
    publicKey: string,
  ): Promise<void> =>
    withMutation(async () => {
      await adapter.setItem(
        SESSION_TRANSITION_KEY,
        JSON.stringify({ sessionData, publicKey }),
      )
    })

  const commitSessionTransition = async (): Promise<
    ZeroDevWalletSession | undefined
  > =>
    withMutation(async () => {
      const transition = parseTransition(
        await adapter.getItem(SESSION_TRANSITION_KEY),
      )
      if (!transition) {
        await adapter.removeItem(SESSION_TRANSITION_KEY)
        return undefined
      }

      await clearAllSessionsUnlocked()
      await storeSessionUnlocked(
        transition.sessionData,
        transition.sessionData.id,
      )
      await adapter.removeItem(SESSION_TRANSITION_KEY)
      return transition.sessionData
    })

  const normalizeKey = (key: string) => key.replace(/^0x/, '').toLowerCase()

  const recoverSessionTransition = async (
    activePublicKey: string | null,
  ): Promise<ZeroDevWalletSession | undefined> => {
    const transition = parseTransition(
      await adapter.getItem(SESSION_TRANSITION_KEY),
    )
    if (!transition) {
      if (await adapter.getItem(SESSION_TRANSITION_KEY)) {
        await adapter.removeItem(SESSION_TRANSITION_KEY)
      }
      return undefined
    }
    if (!activePublicKey) {
      await adapter.removeItem(SESSION_TRANSITION_KEY)
      return undefined
    }
    if (normalizeKey(activePublicKey) !== normalizeKey(transition.publicKey)) {
      await adapter.removeItem(SESSION_TRANSITION_KEY)
      return undefined
    }
    return commitSessionTransition()
  }

  return {
    storeSession,
    getActiveSession,
    getActiveSessionKey,
    getSession,
    listSessionKeys,
    listSessions,
    setActiveSession,
    clearSession,
    clearAllSessions,
    stageSessionTransition,
    commitSessionTransition,
    recoverSessionTransition,
  }
}
