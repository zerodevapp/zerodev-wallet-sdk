import type { LocalAccount } from 'viem/accounts'
import { toViemAccount } from '../adapters/viem.js'
import {
  type CreateTransportOptions,
  createAuthProxyClient,
  createClient,
  type ZeroDevWalletClient,
  zeroDevWalletTransport,
} from '../client/index.js'
import {
  DEFAULT_ORGANIZATION_ID,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
  KMS_SERVER_URL,
} from '../constants.js'
import { createNoopPasskeyStamper } from '../stampers/noopPasskeyStamper.js'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../storage/manager.js'
import { SessionType, type ZeroDevWalletSession } from '../types/session.js'
import { buildClientSignature } from '../utils/buildClientSignature.js'
import { encryptOtpAttempt } from '../utils/encryptOtpAttempt.js'
import { humanReadableDateTime, parseSession } from '../utils/utils.js'
import { createOrganizationIdResolver } from './resolveOrganizationId.js'
export interface ZeroDevWalletConfigCore {
  organizationId?: string
  proxyBaseUrl?: string
  projectId: string
  sessionStorage: StorageAdapter
  rpId: string
  apiKeyStamper: ApiKeyStamper
  passkeyStamper?: PasskeyStamper
  fetchOptions?: CreateTransportOptions['fetchOptions']
}

export type { StorageAdapter, StorageManager } from '../storage/manager.js'
// Re-export new session types
export type { StamperType, ZeroDevWalletSession } from '../types/session.js'

export type AuthParams =
  | {
      type: 'oauth'
      provider: string
      sessionId: string
    }
  | {
      type: 'passkey'
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
    }
  | {
      type: 'otp'
      mode: 'verifyOtp'
      otpId: string
      otpCode: string
      /**
       * The encryption target bundle returned by the matching `sendOtp` call.
       * Required — used to HPKE-encrypt the OTP attempt to the enclave.
       */
      otpEncryptionTargetBundle: string
    }
  | {
      type: 'magicLink'
      mode: 'send'
      email: string
    }
  | {
      type: 'magicLink'
      mode: 'verify'
      otpId: string
      code: string
      /**
       * The encryption target bundle returned by the matching `sendMagicLink`
       * (a.k.a. magicLink `send`) call. Required for the encrypted-OTP flow.
       */
      otpEncryptionTargetBundle: string
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

export async function createZeroDevWalletCore(
  config: ZeroDevWalletConfigCore,
): Promise<ZeroDevWalletSDK> {
  const { projectId, sessionStorage, rpId, apiKeyStamper, organizationId } =
    config
  const passkeyStamper = config.passkeyStamper ?? createNoopPasskeyStamper()

  const sessionStorageManager = createStorageManager(sessionStorage)

  const client = createClient({
    apiKeyStamper,
    passkeyStamper,
    transport: zeroDevWalletTransport({
      baseUrl: config.proxyBaseUrl || `${KMS_SERVER_URL}/api/v1`,
      ...(config.fetchOptions && { fetchOptions: config.fetchOptions }),
    }),
  })

  let cachedAuthProxyConfigId: string | undefined

  // Resolve the Turnkey parent org that stamp-login is signed against: explicit
  // override → backend fetch (/server-info/parent-org-id, cached) → hardcoded
  // fallback if the endpoint is unavailable (older backends). This is why the
  // org no longer needs to be hardcoded/overridden per environment.
  const resolveOrganizationId = createOrganizationIdResolver({
    organizationId,
    fetchParentOrgId: async () => (await client.getParentOrgId()).parentOrgId,
    fallback: DEFAULT_ORGANIZATION_ID,
  })

  return {
    client,
    async getPublicKey() {
      await client.apiKeyStamper.resetKeyPair()
      const compressedPublicKey = await client.apiKeyStamper.getPublicKey()
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
      if (activeSession.stamperType === 'apiKey') {
        const compressedPublicKeyHex =
          await client.apiKeyStamper.prepareKeyRotation()
        const data = await client.loginWithStamp({
          targetPublicKey: compressedPublicKeyHex,
          projectId,
          // Stamp-login is signed against the Turnkey parent org; the backend
          // resolves the sub-org from the stamped credential. Signing the
          // sub-org here makes the relayed payload's org mismatch the
          // signature → Turnkey SIGNATURE_INVALID.
          organizationId: await resolveOrganizationId(),
          stampWith: 'apiKey',
        })
        await client.apiKeyStamper.commitKeyRotation()
        const parsedSession = parseSession(data.session)
        const session: ZeroDevWalletSession = {
          id: `session_indexedDb_${Date.now()}`,
          userId: parsedSession.userId,
          organizationId: parsedSession.organizationId,
          stamperType: 'apiKey',
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
          const popSignature = await client.apiKeyStamper.sign(params.sessionId)
          const data = await client.authenticateWithOAuth({
            provider: params.provider,
            projectId,
            sessionId: params.sessionId,
            popSignature,
          })

          if (data.session) {
            // Parse the JWT to get session data
            const parsedSession = parseSession(data.session)
            const session: ZeroDevWalletSession = {
              id: `session_oauth_${Date.now()}`,
              userId: parsedSession.userId,
              organizationId: parsedSession.organizationId,
              stamperType: 'apiKey',
              sessionType: parsedSession.sessionType || SessionType.READ_WRITE,
              token: data.session,
              expiry: parsedSession.expiry,
              createdAt: Date.now(),
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
            await client.apiKeyStamper.resetKeyPair()
            const tempPublicKey = await client.apiKeyStamper.getPublicKey()
            if (!tempPublicKey) {
              throw new Error('Failed to get public key')
            }
            const name = `ZeroDevWallet-${humanReadableDateTime()}`
            const { attestation, encodedChallenge } =
              await passkeyStamper.register({
                rp: { id: rpId, name: '' },
                userName: name,
              })
            const data = await client.registerWithPasskey({
              attestation,
              challenge: encodedChallenge,
              projectId,
              encodedPublicKey: tempPublicKey,
            })
            const compressedPublicKeyHex =
              await client.apiKeyStamper.prepareKeyRotation()
            const loginData = await client.loginWithStamp({
              projectId,
              targetPublicKey: compressedPublicKeyHex,
              // Sign against the parent org (see refreshSession note) — the
              // backend derives the sub-org from the stamped credential.
              organizationId: await resolveOrganizationId(),
            })
            await client.apiKeyStamper.commitKeyRotation()
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevWalletSession = {
              id: `session_indexedDb_${Date.now()}`,
              stamperType: 'apiKey',
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
            await client.apiKeyStamper.resetKeyPair()
            const generatedPublicKey = await client.apiKeyStamper.getPublicKey()
            if (!generatedPublicKey) {
              throw new Error('Failed to get public key')
            }
            const loginData = await client.loginWithStamp({
              targetPublicKey: generatedPublicKey,
              projectId,
              // Sign against the parent org, not the user's sub-org (see the
              // refreshSession note). The backend derives the sub-org from the
              // stamped passkey credential.
              organizationId: await resolveOrganizationId(),
              stampWith: 'passkey',
            })
            const parsedSession = parseSession(loginData.session)
            const session: ZeroDevWalletSession = {
              id: `session_indexedDb_${Date.now()}`,
              stamperType: 'apiKey',
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
        case 'otp':
        case 'magicLink': {
          // Normalize magicLink params into OTP params
          let otpParams: Extract<AuthParams, { type: 'otp' }>
          if (params.type === 'magicLink') {
            if (params.mode === 'send') {
              // Magic-link vs plain-OTP delivery and the link URL template are
              // configured per-project on the backend (`wallet.otp_configs`);
              // the client just initiates OTP and the backend decides.
              otpParams = {
                type: 'otp',
                mode: 'sendOtp',
                email: params.email,
                contact: { type: 'email', contact: params.email },
              }
            } else {
              otpParams = {
                type: 'otp',
                mode: 'verifyOtp',
                otpId: params.otpId,
                otpCode: params.code,
                otpEncryptionTargetBundle: params.otpEncryptionTargetBundle,
              }
            }
          } else {
            otpParams = params
          }

          if (otpParams.mode === 'sendOtp') {
            const { email, contact } = otpParams

            const data = await client.registerWithOTP({
              email,
              contact,
              projectId,
            })

            return data
          }

          if (otpParams.mode === 'verifyOtp') {
            const { otpId, otpCode, otpEncryptionTargetBundle } = otpParams

            // Step 1: Generate new key pair
            await client.apiKeyStamper.resetKeyPair()
            const targetPublicKey = await client.apiKeyStamper.getPublicKey()

            if (!targetPublicKey) {
              throw new Error('Failed to get public key')
            }

            // Step 2a: HPKE-seal the OTP attempt to the enclave's per-session
            // target key. The auth proxy never sees the plaintext OTP code.
            const encryptedOtpBundle = await encryptOtpAttempt({
              otpCode,
              publicKey: targetPublicKey,
              encryptionTargetBundle: otpEncryptionTargetBundle,
            })

            // Step 2b: Verify OTP via Auth Proxy
            if (!cachedAuthProxyConfigId) {
              const { authProxyConfigId } = await client.getAuthProxyConfigId()
              cachedAuthProxyConfigId = authProxyConfigId
            }
            const authProxyClient = createAuthProxyClient({
              authProxyConfigId: cachedAuthProxyConfigId,
            })

            const { verificationToken } = await authProxyClient.verifyOtp({
              otpId,
              encryptedOtpBundle,
            })

            // Step 3: Build client signature
            const clientSignature = await buildClientSignature({
              verificationToken,
              publicKey: targetPublicKey,
              stamper: client.apiKeyStamper,
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
                stamperType: 'apiKey',
                sessionType:
                  parsedSession.sessionType || SessionType.READ_WRITE,
                token: data.session,
                expiry: parsedSession.expiry,
                createdAt: Date.now(),
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
      await client.apiKeyStamper.resetKeyPair()
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
        getToken: async () => {
          const activeSession = await sessionStorageManager.getActiveSession()
          return activeSession?.token ?? ''
        },
      })
    },
  }
}
