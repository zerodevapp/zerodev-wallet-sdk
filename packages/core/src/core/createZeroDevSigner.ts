import { getWebAuthnAttestation } from '@turnkey/http'
import type { LocalAccount } from 'viem/accounts'
import type { EmailCustomization } from '../actions/auth/index.js'
import { toViemAccount } from '../adapters/viem.js'
import {
  createClient,
  type ZeroDevSignerClient,
  zeroDevSignerTransport,
} from '../client/index.js'
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  KMS_SERVER_URL,
} from '../constants.js'
import { createIndexedDbStamper } from '../stampers/indexedDbStamper.js'
import type { IndexedDbStamper } from '../stampers/types.js'
import { createWebauthnStamper } from '../stampers/webauthnStamper.js'
import { createWebStorageAdapter } from '../storage/adapters.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../storage/manager.js'
import { SessionType, type ZeroDevSignerSession } from '../types/session.js'
import {
  base64UrlEncode,
  generateCompressedPublicKeyFromKeyPair,
  generateRandomBuffer,
  humanReadableDateTime,
  parseSession,
} from '../utils/utils.js'
export interface ZeroDevSignerConfig {
  organizationId?: string
  proxyBaseUrl?: string
  projectId: string
  sessionStorage?: StorageAdapter
  rpId?: string
}

// Re-export EmailCustomization for convenience
export type { EmailCustomization } from '../actions/auth/index.js'
export type { StorageAdapter, StorageManager } from '../storage/manager.js'
// Re-export new session types
export type { StamperType, ZeroDevSignerSession } from '../types/session.js'

export type AuthParams =
  | {
      type: 'oauth'
      provider: string
      redirectUrl?: string
      credential: string
    }
  | {
      type: 'passkey'
      email: string
      mode: 'register' | 'login'
    }
  | {
      type: 'otp'
      mode: 'sendOtp'
      email: string
      contact: {
        type: 'email' | 'sms'
        contact: string
      }
      emailCustomization?: EmailCustomization
    }
  | {
      type: 'otp'
      mode: 'verifyOtp'
      otpId: string
      otpCode: string
      subOrganizationId: string
    }

export interface ZeroDevSignerSDK {
  client: ZeroDevSignerClient | null
  auth: (params: AuthParams) => Promise<any>

  getPublicKey: () => Promise<string | null>

  getSession: () => Promise<ZeroDevSignerSession | undefined>
  getAllSessions: () => Promise<Record<string, ZeroDevSignerSession>>
  switchSession: (
    sessionId: string,
  ) => Promise<ZeroDevSignerSession | undefined>
  clearSession: (sessionId: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  refreshSession: (
    sessionId?: string,
  ) => Promise<ZeroDevSignerSession | undefined>

  logout: () => Promise<boolean>

  toAccount: () => Promise<LocalAccount>
}

export async function createZeroDevSigner(
  config: ZeroDevSignerConfig,
): Promise<ZeroDevSignerSDK> {
  const {
    projectId,
    sessionStorage,
    rpId = window.location.hostname,
    organizationId = DEFAULT_ORGANIZATION_ID,
  } = config

  const sessionStorageManager = createStorageManager(
    sessionStorage || createWebStorageAdapter(),
  )

  const indexedDbStamper = await createIndexedDbStamper()

  const webauthnStamper = await createWebauthnStamper({ rpId })

  let currentClient: ZeroDevSignerClient | null = null

  const indexedDbClient = createClient({
    stamper: indexedDbStamper,
    transport: zeroDevSignerTransport({
      baseUrl: config.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
    }),
  })

  const passkeyClient = createClient({
    stamper: webauthnStamper,
    transport: zeroDevSignerTransport({
      baseUrl: config.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
    }),
  })

  // Restore active session on initialization
  const activeSession = await sessionStorageManager.getActiveSession()

  if (activeSession) {
    try {
      if (activeSession.stamperType === 'indexedDb') {
        currentClient = indexedDbClient
      }
    } catch (_error) {}
  }

  return {
    client: currentClient,
    async getPublicKey() {
      await indexedDbClient.stamper.resetKeyPair()
      const compressedPublicKey = await indexedDbClient.stamper.getPublicKey()
      return compressedPublicKey
    },

    async getSession() {
      return sessionStorageManager.getActiveSession()
    },

    async getAllSessions() {
      const sessions = await sessionStorageManager.listSessions()
      const sessionMap: Record<string, ZeroDevSignerSession> = {}
      for (const session of sessions) {
        sessionMap[session.id] = session
      }
      return sessionMap
    },

    async switchSession(sessionId: string) {
      await sessionStorageManager.setActiveSession(sessionId)
      const session = await sessionStorageManager.getActiveSession()

      if (session) {
        // Update current client based on session's stamper type
        let stamper: IndexedDbStamper | undefined
        if (session.stamperType === 'indexedDb') {
          stamper = indexedDbStamper
        }

        if (stamper) {
          currentClient = createClient({
            stamper,
            transport: zeroDevSignerTransport({
              baseUrl: config.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
            }),
          })
        }
      }

      return session
    },

    async clearSession(sessionId: string) {
      await sessionStorageManager.clearSession(sessionId)
    },

    async clearAllSessions() {
      await sessionStorageManager.clearAllSessions()
      currentClient = null
    },

    async refreshSession(sessionId?: string) {
      const activeSession = sessionId
        ? await sessionStorageManager.getSession(sessionId)
        : await sessionStorageManager.getActiveSession()
      if (!activeSession) {
        throw new Error('No active session')
      }
      if (activeSession.stamperType === 'indexedDb') {
        const newKeyPair = await crypto.subtle.generateKey(
          {
            name: 'ECDSA',
            namedCurve: 'P-256',
          },
          false,
          ['sign', 'verify'],
        )
        const compressedPublicKeyHex =
          await generateCompressedPublicKeyFromKeyPair(newKeyPair)
        const data = await indexedDbClient.loginWithStamp({
          targetPublicKey: compressedPublicKeyHex,
          projectId,
          organizationId: activeSession.organizationId,
        })
        await indexedDbClient.stamper.resetKeyPair(newKeyPair)
        const parsedSession = parseSession(data.session)
        const session: ZeroDevSignerSession = {
          id: `session_indexedDb_${Date.now()}`,
          userId: parsedSession.userId,
          organizationId: parsedSession.organizationId,
          stamperType: 'indexedDb',
          sessionType: SessionType.READ_WRITE,
          token: data.session,
          expiry: parsedSession.expiry,
          createdAt: Date.now(),
        }
        await sessionStorageManager.clearSession(activeSession.id)
        await sessionStorageManager.storeSession(session, session.id)
        return session
      }
      throw new Error('Invalid session type')
    },

    // [TODO] refactor to smaller utils/actions
    async auth(params: AuthParams) {
      switch (params.type) {
        case 'oauth': {
          const { credential } = params
          const targetPublicKey = await indexedDbClient.stamper.getPublicKey()

          if (!targetPublicKey) {
            throw new Error('Failed to get public key')
          }

          const data = await indexedDbClient.authenticateWithOAuth({
            oidcToken: credential,
            provider: 'google',
            targetPublicKey,
            projectId,
          })

          if (data.turnkeySession) {
            // Parse the JWT to get session data
            const parsedSession = parseSession(data.turnkeySession)
            const session: ZeroDevSignerSession = {
              id: `session_oauth_${Date.now()}`,
              userId: parsedSession.userId,
              organizationId: parsedSession.organizationId,
              stamperType: 'indexedDb',
              sessionType: parsedSession.sessionType || SessionType.READ_WRITE,
              token: data.turnkeySession,
              expiry: parsedSession.expiry,
              createdAt: Date.now(),
              publicKey: targetPublicKey,
            }
            await sessionStorageManager.storeSession(session, session.id)
          }
          currentClient = indexedDbClient
          return data
        }
        case 'passkey': {
          const { type } = params
          if (
            type === 'passkey' &&
            'mode' in params &&
            params.mode === 'register'
          ) {
            const { email } = params
            await indexedDbClient.stamper.resetKeyPair()
            const tempPublicKey = await indexedDbClient.stamper.getPublicKey()
            if (!tempPublicKey) {
              throw new Error('Failed to get public key')
            }
            const challenge = generateRandomBuffer()
            const encodedChallenge = base64UrlEncode(challenge)
            const authenticatorUserId = generateRandomBuffer()
            const name = `ZeroDevSigner-${humanReadableDateTime()}-${email}`
            const attestation = await getWebAuthnAttestation({
              publicKey: {
                rp: { id: rpId, name: '' },
                challenge,
                pubKeyCredParams: [
                  {
                    type: 'public-key',
                    alg: -7,
                  },
                  {
                    type: 'public-key',
                    alg: -257,
                  },
                ],
                user: {
                  id: authenticatorUserId,
                  name,
                  displayName: name,
                },
              },
            })
            const data = await passkeyClient.registerWithPasskey({
              email,
              attestation,
              challenge: encodedChallenge,
              projectId,
              encodedPublicKey: tempPublicKey,
            })
            const newKeyPair = await crypto.subtle.generateKey(
              {
                name: 'ECDSA',
                namedCurve: 'P-256',
              },
              false,
              ['sign', 'verify'],
            )
            const compressedPublicKeyHex =
              await generateCompressedPublicKeyFromKeyPair(newKeyPair)
            const loginData = await indexedDbClient.loginWithStamp({
              projectId,
              targetPublicKey: compressedPublicKeyHex,
              organizationId: data.subOrganizationId,
            })
            await indexedDbClient.stamper.resetKeyPair(newKeyPair)
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevSignerSession = {
              id: `session_indexedDb_${Date.now()}`,
              stamperType: 'indexedDb',
              createdAt: Date.now(),
              sessionType: SessionType.READ_WRITE,
              userId: parsedSession.userId,
              organizationId: parsedSession.organizationId,
              expiry:
                Date.now() +
                Number(DEFAULT_SESSION_EXPIRATION_IN_SECONDS) * 1000,
              token: loginData.session,
            }
            await sessionStorageManager.storeSession(session, session.id)
            currentClient = indexedDbClient
            return data
          }
          if (
            type === 'passkey' &&
            'mode' in params &&
            params.mode === 'login'
          ) {
            await indexedDbClient.stamper.resetKeyPair()
            const generatedPublicKey =
              await indexedDbClient.stamper.getPublicKey()
            if (!generatedPublicKey) {
              throw new Error('Failed to get public key')
            }
            const loginData = await passkeyClient.loginWithStamp({
              targetPublicKey: generatedPublicKey,
              projectId,
              organizationId,
            })
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevSignerSession = {
              id: `session_indexedDb_${Date.now()}`,
              stamperType: 'indexedDb',
              createdAt: Date.now(),
              sessionType: SessionType.READ_WRITE,
              userId: parsedSession.userId,
              organizationId: parsedSession.organizationId,
              expiry:
                Date.now() +
                Number(DEFAULT_SESSION_EXPIRATION_IN_SECONDS) * 1000,
              token: loginData.session,
            }
            await sessionStorageManager.storeSession(session, session.id)
            currentClient = indexedDbClient
            return loginData
          }
          throw new Error('Passkey authentication requires passkey parameter')
        }
        case 'otp': {
          const { type, mode } = params

          if (type === 'otp' && mode === 'sendOtp') {
            const { email, contact, emailCustomization } = params

            const data = await indexedDbClient.registerWithOTP({
              email,
              contact,
              projectId,
              ...(emailCustomization && { emailCustomization }),
            })

            return data
          }

          if (type === 'otp' && mode === 'verifyOtp') {
            const { otpId, otpCode, subOrganizationId } = params
            await indexedDbClient.stamper.resetKeyPair()
            const targetPublicKey = await indexedDbClient.stamper.getPublicKey()

            if (!targetPublicKey) {
              throw new Error('Failed to get public key')
            }

            const data = await indexedDbClient.loginWithOTP({
              otpId,
              otpCode,
              subOrganizationId,
              encodedPublicKey: targetPublicKey,
              projectId,
            })

            if (data.session) {
              // Parse the JWT to get session data
              const parsedSession = parseSession(data.session)
              const session: ZeroDevSignerSession = {
                id: `session_otp_${Date.now()}`,
                userId: parsedSession.userId,
                organizationId: parsedSession.organizationId,
                stamperType: 'indexedDb',
                sessionType:
                  parsedSession.sessionType || SessionType.READ_WRITE,
                token: data.session,
                expiry: parsedSession.expiry,
                createdAt: Date.now(),
                publicKey: targetPublicKey,
              }
              await sessionStorageManager.storeSession(session, session.id)
            }
            currentClient = indexedDbClient
            return data
          }

          throw new Error('OTP authentication requires mode parameter')
        }
        default:
          throw new Error(`Unknown auth type: ${(params as any).type}`)
      }
    },

    async logout() {
      await sessionStorageManager.clearAllSessions()
      currentClient = null
      await indexedDbClient.stamper.resetKeyPair()
      return true
    },

    async toAccount(): Promise<LocalAccount> {
      const session = await sessionStorageManager.getActiveSession()
      if (!session) {
        throw new Error('No active session')
      }
      if (!currentClient) {
        throw new Error('No client')
      }

      return toViemAccount({
        client: currentClient,
        organizationId: session.organizationId,
        projectId,
      })
    },
  }
}
