import { getWebAuthnAttestation } from '@turnkey/http'
import type { LocalAccount } from 'viem/accounts'
import type { EmailCustomization } from '../actions/auth/index.js'
import { toViemAccount } from '../adapters/viem.js'
import {
  createAuthProxyClient,
  createClient,
  type ZeroDevWalletClient,
  zeroDevWalletTransport,
} from '../client/index.js'
import {
  DEFAULT_AUTH_PROXY_CONFIG_ID,
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  KMS_SERVER_URL,
} from '../constants.js'
import { createIndexedDbStamper } from '../stampers/indexedDbStamper.js'
import { createWebauthnStamper } from '../stampers/webauthnStamper.js'
import { createWebStorageAdapter } from '../storage/adapters.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../storage/manager.js'
import { SessionType, type ZeroDevWalletSession } from '../types/session.js'
import { buildClientSignature } from '../utils/buildClientSignature.js'
import {
  base64UrlEncode,
  generateCompressedPublicKeyFromKeyPair,
  generateRandomBuffer,
  humanReadableDateTime,
  parseSession,
} from '../utils/utils.js'
export interface ZeroDevWalletConfig {
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
export type { StamperType, ZeroDevWalletSession } from '../types/session.js'

export type AuthParams =
  | {
      type: 'oauth'
      provider: string
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
    }

export interface ZeroDevWalletSDK {
  client: ZeroDevWalletClient
  auth: (params: AuthParams) => Promise<any>

  getPublicKey: () => Promise<string | null>

  getSession: () => Promise<ZeroDevWalletSession | undefined>
  getAllSessions: () => Promise<Record<string, ZeroDevWalletSession>>
  switchSession: (
    sessionId: string,
  ) => Promise<ZeroDevWalletSession | undefined>
  clearSession: (sessionId: string) => Promise<void>
  clearAllSessions: () => Promise<void>
  refreshSession: (
    sessionId?: string,
  ) => Promise<ZeroDevWalletSession | undefined>

  logout: () => Promise<boolean>

  toAccount: () => Promise<LocalAccount>
}

export async function createZeroDevWallet(
  config: ZeroDevWalletConfig,
): Promise<ZeroDevWalletSDK> {
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

  const client = createClient({
    indexedDbStamper,
    webauthnStamper,
    transport: zeroDevWalletTransport({
      baseUrl: config.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
    }),
  })

  return {
    client,
    async getPublicKey() {
      await client.indexedDbStamper.resetKeyPair()
      const compressedPublicKey = await client.indexedDbStamper.getPublicKey()
      return compressedPublicKey
    },

    async getSession() {
      return sessionStorageManager.getActiveSession()
    },

    async getAllSessions() {
      const sessions = await sessionStorageManager.listSessions()
      const sessionMap: Record<string, ZeroDevWalletSession> = {}
      for (const session of sessions) {
        sessionMap[session.id] = session
      }
      return sessionMap
    },

    async switchSession(sessionId: string) {
      await sessionStorageManager.setActiveSession(sessionId)
      const session = await sessionStorageManager.getActiveSession()

      return session
    },

    async clearSession(sessionId: string) {
      await sessionStorageManager.clearSession(sessionId)
    },

    async clearAllSessions() {
      await sessionStorageManager.clearAllSessions()
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
        const data = await client.loginWithStamp({
          targetPublicKey: compressedPublicKeyHex,
          projectId,
          organizationId: activeSession.organizationId,
          stampWith: 'indexedDb',
        })
        await client.indexedDbStamper.resetKeyPair(newKeyPair)
        const parsedSession = parseSession(data.session)
        const session: ZeroDevWalletSession = {
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
          // Backend OAuth flow - the backend reads the OAuth session from a cookie
          // set during the OAuth popup flow via /oauth/google/login
          const data = await client.authenticateWithOAuth({
            provider: params.provider,
            projectId,
          })

          if (data.session) {
            // Parse the JWT to get session data
            const parsedSession = parseSession(data.session)
            const publicKey = await client.indexedDbStamper.getPublicKey()
            const session: ZeroDevWalletSession = {
              id: `session_oauth_${Date.now()}`,
              userId: parsedSession.userId,
              organizationId: parsedSession.organizationId,
              stamperType: 'indexedDb',
              sessionType: parsedSession.sessionType || SessionType.READ_WRITE,
              token: data.session,
              expiry: parsedSession.expiry,
              createdAt: Date.now(),
              publicKey: publicKey || '',
            }
            await sessionStorageManager.storeSession(session, session.id)
          }
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
            await client.indexedDbStamper.resetKeyPair()
            const tempPublicKey = await client.indexedDbStamper.getPublicKey()
            if (!tempPublicKey) {
              throw new Error('Failed to get public key')
            }
            const challenge = generateRandomBuffer()
            const encodedChallenge = base64UrlEncode(challenge)
            const authenticatorUserId = generateRandomBuffer()
            const name = `ZeroDevWallet-${humanReadableDateTime()}-${email}`
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
            const data = await client.registerWithPasskey({
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
            const loginData = await client.loginWithStamp({
              projectId,
              targetPublicKey: compressedPublicKeyHex,
              organizationId: data.subOrganizationId,
            })
            await client.indexedDbStamper.resetKeyPair(newKeyPair)
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevWalletSession = {
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
            return data
          }
          if (
            type === 'passkey' &&
            'mode' in params &&
            params.mode === 'login'
          ) {
            await client.indexedDbStamper.resetKeyPair()
            const generatedPublicKey =
              await client.indexedDbStamper.getPublicKey()
            if (!generatedPublicKey) {
              throw new Error('Failed to get public key')
            }
            const loginData = await client.loginWithStamp({
              targetPublicKey: generatedPublicKey,
              projectId,
              organizationId,
              stampWith: 'webauthn',
            })
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevWalletSession = {
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
            return loginData
          }
          throw new Error('Passkey authentication requires passkey parameter')
        }
        case 'otp': {
          const { type, mode } = params

          if (type === 'otp' && mode === 'sendOtp') {
            const { email, contact, emailCustomization } = params

            const data = await client.registerWithOTP({
              email,
              contact,
              projectId,
              ...(emailCustomization && { emailCustomization }),
            })

            return data
          }

          if (type === 'otp' && mode === 'verifyOtp') {
            const { otpId, otpCode } = params

            // Step 1: Generate new key pair
            await client.indexedDbStamper.resetKeyPair()
            const targetPublicKey = await client.indexedDbStamper.getPublicKey()

            if (!targetPublicKey) {
              throw new Error('Failed to get public key')
            }

            // Step 2: Verify OTP via Auth Proxy
            const authProxyClient = createAuthProxyClient({
              authProxyConfigId: DEFAULT_AUTH_PROXY_CONFIG_ID,
            })

            const { verificationToken } = await authProxyClient.verifyOtp({
              otpId,
              otpCode,
              public_key: targetPublicKey,
            })

            // Step 3: Build client signature
            const clientSignature = await buildClientSignature({
              verificationToken,
              publicKey: targetPublicKey,
              stamper: client.indexedDbStamper,
            })

            // Step 4: Login via backend (not Auth Proxy!)
            const data = await client.loginWithOTP({
              verificationToken,
              clientSignature,
              projectId,
            })

            if (data.session) {
              // Parse the JWT to get session data
              const parsedSession = parseSession(data.session)
              const session: ZeroDevWalletSession = {
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
      await client.indexedDbStamper.resetKeyPair()
      return true
    },

    async toAccount(): Promise<LocalAccount> {
      const session = await sessionStorageManager.getActiveSession()
      if (!session) {
        throw new Error('No active session')
      }

      return toViemAccount({
        client,
        organizationId: session.organizationId,
        projectId,
        token: session.token ?? '',
      })
    },
  }
}
