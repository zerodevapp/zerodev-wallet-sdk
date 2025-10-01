import type { DoorwaySession } from '../types/session.js'
import { normalizeTimestamp } from '../utils/utils.js'

export type StorageAdapter = {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

export type StorageManager = {
  storeSession(sessionData: DoorwaySession, sessionKey: string): Promise<void>
  getActiveSession(): Promise<DoorwaySession | undefined>
  getActiveSessionKey(): Promise<string | undefined>
  getSession(sessionKey: string): Promise<DoorwaySession | undefined>
  listSessionKeys(): Promise<string[]>
  listSessions(): Promise<DoorwaySession[]>
  setActiveSession(sessionKey: string): Promise<void>
  clearSession(sessionKey: string): Promise<void>
  clearAllSessions(): Promise<void>
}

export function createStorageManager(adapter: StorageAdapter): StorageManager {
  const ACTIVE_SESSION_KEY = '@doorway/active_session'
  const ALL_SESSIONS_KEY = '@doorway/sessions'

  const storeSession = async (
    sessionData: DoorwaySession,
    sessionKey: string,
  ): Promise<void> => {
    // Store the session data
    await adapter.setItem(sessionKey, JSON.stringify(sessionData))

    // Add to sessions list if not already present
    const sessionsStr = await adapter.getItem(ALL_SESSIONS_KEY)
    const sessions = JSON.parse(sessionsStr || '[]')
    if (!sessions.includes(sessionKey)) {
      sessions.push(sessionKey)
      await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(sessions))
    }

    // Set as active session
    await adapter.setItem(ACTIVE_SESSION_KEY, sessionKey)
  }

  const getActiveSession = async (): Promise<DoorwaySession | undefined> => {
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
  ): Promise<DoorwaySession | undefined> => {
    const sessionStr = await adapter.getItem(sessionKey)
    if (!sessionStr) return undefined

    try {
      const session: DoorwaySession = JSON.parse(sessionStr)

      // Check if session is expired
      if (session.expiry && normalizeTimestamp(session.expiry) < Date.now()) {
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

  const listSessionKeys = async (): Promise<string[]> => {
    const sessionsStr = await adapter.getItem(ALL_SESSIONS_KEY)
    const sessionKeys = JSON.parse(sessionsStr || '[]')

    // Clean up any keys that don't have corresponding sessions
    const validKeys: string[] = []
    for (const key of sessionKeys) {
      const exists = await adapter.getItem(key)
      if (exists) {
        validKeys.push(key)
      }
    }

    // Update the list if we found invalid keys
    if (validKeys.length !== sessionKeys.length) {
      await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(validKeys))
    }

    return validKeys
  }

  const listSessions = async (): Promise<DoorwaySession[]> => {
    const sessionKeys = await listSessionKeys()
    const sessions: DoorwaySession[] = []

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

    await adapter.setItem(ACTIVE_SESSION_KEY, sessionKey)
  }

  const clearSession = async (sessionKey: string): Promise<void> => {
    // Remove the session data
    await adapter.removeItem(sessionKey)

    // Remove from sessions list
    const sessions = await listSessionKeys()
    const updated = sessions.filter((k) => k !== sessionKey)
    await adapter.setItem(ALL_SESSIONS_KEY, JSON.stringify(updated))

    // Clear active session if it was the cleared one
    const activeKey = await adapter.getItem(ACTIVE_SESSION_KEY)
    if (activeKey === sessionKey) {
      await adapter.removeItem(ACTIVE_SESSION_KEY)
    }
  }

  const clearAllSessions = async (): Promise<void> => {
    const sessions = await listSessionKeys()

    // Remove all session data
    for (const key of sessions) {
      await adapter.removeItem(key)
    }

    // Clear the metadata
    await adapter.removeItem(ALL_SESSIONS_KEY)
    await adapter.removeItem(ACTIVE_SESSION_KEY)
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
  }
}
