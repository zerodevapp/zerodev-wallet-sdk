import { getWebAuthnAttestation } from '@turnkey/http'
import type { LocalAccount } from 'viem/accounts'
import type { EmailCustomization } from '../actions/auth/index.js'
import { toViemAccount } from '../adapters/viem.js'
import {
  createClient,
  type DoorwayClient,
  doorwayTransport,
} from '../client/index.js'
import {
  DEFAULT_IFRAME_CONTAINER_ID,
  DEFAULT_IFRAME_ELEMENT_ID,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
} from '../constants.js'
import { createIframeStamper } from '../stampers/iframeStamper.js'
import { createIndexedDbStamper } from '../stampers/indexedDbStamper.js'
import type { IframeStamper, IndexedDbStamper } from '../stampers/types.js'
import { createWebauthnStamper } from '../stampers/webauthnStamper.js'
import { createWebStorageAdapter } from '../storage/adapters.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../storage/manager.js'
import { type DoorwaySession, SessionType } from '../types/session.js'
import {
  base64UrlEncode,
  generateCompressedPublicKeyFromKeyPair,
  generateRandomBuffer,
  parseSession,
} from '../utils/utils.js'
export interface DoorwayConfig {
  organizationId?: string
  proxyBaseUrl?: string
  iframeUrl?: string
  iframeContainer?: HTMLElement | null
  iframeElementId?: string
  projectId: string
  sessionStorage?: StorageAdapter
  rpId?: string
}

// Re-export EmailCustomization for convenience
export type { EmailCustomization } from '../actions/auth/index.js'
export type { StorageAdapter, StorageManager } from '../storage/manager.js'
// Re-export new session types
export type { DoorwaySession, StamperType } from '../types/session.js'

export type AuthParams =
  | {
      type: 'email'
      email: string
      emailCustomization?: EmailCustomization
    }
  | {
      type: 'email'
      bundle: string
    }
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
      mode: 'register'
      email: string
      contact: {
        type: 'email' | 'sms'
        contact: string
      }
    }
  | {
      type: 'otp'
      mode: 'login'
      otpId: string
      otpCode: string
      subOrganizationId: string
    }

export interface DoorwaySDK {
  client: DoorwayClient | null
  auth: (params: AuthParams) => Promise<any>

  getPublicKeys: () => Promise<{
    publicKey: string | null
    compressedPublicKey: string | null
  }>

  getSession: () => Promise<DoorwaySession | undefined>
  getAllSessions: () => Promise<Record<string, DoorwaySession>>
  switchSession: (sessionId: string) => Promise<DoorwaySession | undefined>
  clearSession: (sessionId: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  refreshSession: (sessionId?: string) => Promise<DoorwaySession | undefined>

  logout: () => Promise<boolean>

  toAccount: () => Promise<LocalAccount>
}

export async function createDoorway(
  config: DoorwayConfig,
): Promise<DoorwaySDK> {
  const { projectId, sessionStorage, rpId = window.location.hostname } = config

  const sessionStorageManager = createStorageManager(
    sessionStorage || createWebStorageAdapter(),
  )

  const iframeStamper = await createIframeStamper({
    iframeContainer:
      config.iframeContainer ||
      document.getElementById(DEFAULT_IFRAME_CONTAINER_ID),
    iframeUrl: config.iframeUrl || 'https://auth.turnkey.com',
    iframeElementId: config.iframeElementId || DEFAULT_IFRAME_ELEMENT_ID,
  })

  const indexedDbStamper = await createIndexedDbStamper()

  const webauthnStamper = await createWebauthnStamper({ rpId })

  let currentClient: DoorwayClient | null = null

  const authIframeClient = createClient({
    stamper: iframeStamper,
    transport: doorwayTransport({
      baseUrl: config.proxyBaseUrl || 'http://localhost:3001/api/v1',
    }),
  })

  const indexedDbClient = createClient({
    stamper: indexedDbStamper,
    transport: doorwayTransport({
      baseUrl: config.proxyBaseUrl || 'http://localhost:3001/api/v1',
    }),
  })

  const passkeyClient = createClient({
    stamper: webauthnStamper,
    transport: doorwayTransport({
      baseUrl: config.proxyBaseUrl || 'http://localhost:3001/api/v1',
    }),
  })

  // Restore active session on initialization
  const activeSession = await sessionStorageManager.getActiveSession()

  if (activeSession) {
    try {
      if (activeSession.stamperType === 'iframe' && activeSession.token) {
        await (iframeStamper as IframeStamper).injectCredentialBundle(
          activeSession.token,
        )
        currentClient = authIframeClient
      } else if (activeSession.stamperType === 'indexedDb') {
        currentClient = indexedDbClient
      }
    } catch (_error) {}
  }

  return {
    client: currentClient,
    async getPublicKeys() {
      const publicKey = await iframeStamper.getPublicKey()
      const compressedPublicKey = await indexedDbStamper.getPublicKey()
      return {
        publicKey,
        compressedPublicKey,
      }
    },

    async getSession() {
      return sessionStorageManager.getActiveSession()
    },

    async getAllSessions() {
      const sessions = await sessionStorageManager.listSessions()
      const sessionMap: Record<string, DoorwaySession> = {}
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
        let stamper: IframeStamper | IndexedDbStamper | undefined
        if (session.stamperType === 'iframe') {
          stamper = iframeStamper
          if (session.token) {
            await (stamper as IframeStamper).injectCredentialBundle(
              session.token,
            )
          }
        } else if (session.stamperType === 'indexedDb') {
          stamper = indexedDbStamper
        }

        if (stamper) {
          currentClient = createClient({
            stamper,
            transport: doorwayTransport({
              baseUrl: config.proxyBaseUrl || 'http://localhost:3001/api/v1',
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
      if (activeSession.stamperType === 'iframe') {
        throw new Error('Not implemented')
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
        const session: DoorwaySession = {
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
        case 'email': {
          const { type } = params

          if (type === 'email' && 'email' in params) {
            const { email, emailCustomization } = params

            const targetPublicKey =
              await authIframeClient.stamper.getPublicKey()

            if (!targetPublicKey) {
              throw new Error('Failed to get public key')
            }

            const data = await authIframeClient.authenticateWithEmail({
              email,
              ...(emailCustomization && { emailCustomization }),
              targetPublicKey,
              projectId,
            })

            return data
          }
          if ('bundle' in params) {
            const { bundle } = params
            await (
              authIframeClient.stamper as IframeStamper
            ).injectCredentialBundle(bundle)

            const whoAmI = await authIframeClient.getWhoami({
              organizationId: config.organizationId || '',
              projectId,
            })
            const session: DoorwaySession = {
              id: `session_iframe_${Date.now()}`,
              userId: whoAmI.userId,
              organizationId: whoAmI.organizationId,
              stamperType: 'iframe',
              sessionType: SessionType.READ_WRITE,
              token: bundle,
              expiry:
                Date.now() +
                Number(DEFAULT_SESSION_EXPIRATION_IN_SECONDS) * 1000,
              createdAt: Date.now(),
            }
            await sessionStorageManager.storeSession(session, session.id)
            currentClient = authIframeClient
            return whoAmI
          }
          throw new Error(
            'Email authentication requires either email or bundle parameter',
          )
        }
        case 'oauth': {
          const { credential } = params
          const targetPublicKey = await indexedDbStamper.getPublicKey()

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
            const session: DoorwaySession = {
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
            const name = `Doorway-${email}-${new Date().toISOString()}`
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
            const session: DoorwaySession = {
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
              organizationId: config.organizationId || '',
            })
            const parsedSession = parseSession(loginData.session)
            const session: DoorwaySession = {
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

          if (type === 'otp' && mode === 'register') {
            const { email, contact } = params

            const data = await indexedDbClient.registerWithOTP({
              email,
              contact,
              projectId,
            })

            return data
          }

          if (type === 'otp' && mode === 'login') {
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
              const session: DoorwaySession = {
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
