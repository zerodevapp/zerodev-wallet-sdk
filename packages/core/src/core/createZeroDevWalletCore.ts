import type { LocalAccount } from 'viem/accounts'
import { toViemAccount } from '../adapters/viem.js'
import {
  type CreateTransportOptions,
  createAuthProxyClient,
  createClient,
  type ZeroDevWalletClient,
  zeroDevWalletTransport,
} from '../client/index.js'
import { DEFAULT_ORGANIZATION_ID, KMS_SERVER_URL } from '../constants.js'
import { RestRequestError } from '../errors/request.js'
import { createNoopPasskeyStamper } from '../stampers/noopPasskeyStamper.js'
import type { ApiKeyStamper, PasskeyStamper } from '../stampers/types.js'
import {
  createStorageManager,
  type StorageAdapter,
} from '../storage/manager.js'
import { SessionType, type ZeroDevWalletSession } from '../types/session.js'
import { buildClientSignature } from '../utils/buildClientSignature.js'
import { withCrossTabLock } from '../utils/crossTabLock.js'
import { encryptOtpAttempt } from '../utils/encryptOtpAttempt.js'
import { createOrganizationIdResolver } from '../utils/resolveOrganizationId.js'
import {
  humanReadableDateTime,
  normalizeTimestamp,
  parseSession,
} from '../utils/utils.js'
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

  /**
   * Revoke the active remote key, then erase local state. `force` still tries
   * remote revocation first but permits local recovery if that attempt fails;
   * use it only when accepting that the remote key may remain until expiry.
   */
  logout: (options?: { force?: boolean }) => Promise<boolean>

  toAccount: () => Promise<LocalAccount>
}

// The browser/native key vault is a single physical slot shared by SDK
// instances, so key transitions must be serialized across projects.
let keyTransitionTail = Promise.resolve()

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

  let preparedOAuthPublicKey: string | undefined

  const prepareFreshKeyRotation = async () => {
    if (preparedOAuthPublicKey) {
      await client.apiKeyStamper.discardKeyRotation()
      preparedOAuthPublicKey = undefined
    }
    return client.apiKeyStamper.prepareKeyRotation()
  }

  const withKeyTransition = async <T>(transition: () => Promise<T>) => {
    const result = keyTransitionTail.then(transition)
    keyTransitionTail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const normalizeKey = (key: string) => key.replace(/^0x/, '').toLowerCase()

  const createReplacementSession = (
    token: string,
    expectedPublicKey: string,
    idPrefix: 'indexedDb' | 'oauth' | 'otp',
    sessionType?: SessionType,
  ): ZeroDevWalletSession => {
    const parsed = parseSession(token)
    if (
      !parsed.publicKey ||
      normalizeKey(parsed.publicKey) !== normalizeKey(expectedPublicKey)
    ) {
      throw new Error(
        'Session public key does not match the locally prepared signing key',
      )
    }
    const now = Date.now()
    return {
      id: `session_${idPrefix}_${now}`,
      userId: parsed.userId,
      organizationId: parsed.organizationId,
      stamperType: 'apiKey',
      sessionType: sessionType ?? parsed.sessionType ?? SessionType.READ_WRITE,
      token,
      publicKey: expectedPublicKey,
      expiry: parsed.expiry,
      createdAt: now,
    }
  }

  // Callers must hold the cross-tab lock; see commitReplacementSession.
  const commitReplacementSessionLocked = async (
    session: ZeroDevWalletSession,
    targetPublicKey: string,
  ) => {
    await sessionStorageManager.stageSessionTransition(session, targetPublicKey)
    try {
      await client.apiKeyStamper.commitKeyRotation()
    } catch (error) {
      await client.apiKeyStamper.discardKeyRotation()
      const activePublicKey = await client.apiKeyStamper.getPublicKey()
      const recovered =
        await sessionStorageManager.recoverSessionTransition(activePublicKey)
      if (
        !activePublicKey ||
        normalizeKey(activePublicKey) !== normalizeKey(targetPublicKey) ||
        !recovered
      ) {
        throw error
      }
      return
    }

    try {
      const committed = await sessionStorageManager.commitSessionTransition()
      if (!committed) {
        throw new Error('Session transition journal disappeared before commit')
      }
    } catch (error) {
      const recovered = await sessionStorageManager.recoverSessionTransition(
        await client.apiKeyStamper.getPublicKey(),
      )
      if (!recovered) throw error
    }
  }
  const commitReplacementSession = (
    session: ZeroDevWalletSession,
    targetPublicKey: string,
  ) =>
    withCrossTabLock(() =>
      commitReplacementSessionLocked(session, targetPublicKey),
    )

  await withKeyTransition(() =>
    withCrossTabLock(async () => {
      // The stamper read the vault before this tab got the lock; another tab
      // may have committed a new key since. A stale key here would look like a
      // mismatch and clear that tab's valid session.
      await client.apiKeyStamper.reload?.()
      const activePublicKey = await client.apiKeyStamper.getPublicKey()
      await sessionStorageManager.recoverSessionTransition(activePublicKey)
      const restoredSession = await sessionStorageManager.getActiveSession()
      if (restoredSession) {
        try {
          const restoredPublicKey = parseSession(
            restoredSession.token,
          ).publicKey
          if (
            !activePublicKey ||
            !restoredPublicKey ||
            normalizeKey(activePublicKey) !== normalizeKey(restoredPublicKey)
          ) {
            await sessionStorageManager.clearAllSessions()
          }
        } catch {
          await sessionStorageManager.clearAllSessions()
        }
      }
    }),
  )

  return {
    client,
    async getPublicKey() {
      return withKeyTransition(async () => {
        if (preparedOAuthPublicKey) return preparedOAuthPublicKey
        preparedOAuthPublicKey = await client.apiKeyStamper.prepareKeyRotation()
        return preparedOAuthPublicKey
      })
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
      const activeSessionKey = await sessionStorageManager.getActiveSessionKey()
      if (sessionId !== activeSessionKey) {
        throw new Error(
          'Session switching is not supported with a single active key vault',
        )
      }
      return sessionStorageManager.getActiveSession()
    },

    async clearSession(sessionId: string) {
      if ((await sessionStorageManager.getActiveSessionKey()) === sessionId) {
        throw new Error(
          'Refusing to clear the active session locally; use logout() to revoke its remote key first.',
        )
      }
      await sessionStorageManager.clearSession(sessionId)
    },

    async clearAllSessions() {
      // Under the lock, so it cannot remove another tab's in-flight journal.
      return withKeyTransition(() =>
        withCrossTabLock(async () => {
          if (await sessionStorageManager.getActiveSession()) {
            throw new Error(
              'Refusing to clear the active session locally; use logout() to revoke its remote key first.',
            )
          }
          await sessionStorageManager.clearAllSessions()
        }),
      )
    },

    async refreshSession(sessionId?: string) {
      // Without an id, refresh the session active when called, so a tab that
      // then waits behind another tab's refresh adopts it instead of rotating
      // again. Read now but awaited inside, so the call keeps its queue place.
      const expected =
        sessionId === undefined
          ? sessionStorageManager.getActiveSessionKey()
          : Promise.resolve(sessionId)
      expected.catch(() => undefined)
      return withKeyTransition(() =>
        withCrossTabLock(async () => {
          const expectedId = await expected
          const activeSessionKey =
            await sessionStorageManager.getActiveSessionKey()
          const activeSession = await sessionStorageManager.getActiveSession()
          if (!activeSession) {
            throw new Error('No active session')
          }
          if (expectedId && expectedId !== activeSessionKey) {
            // Another tab replaced the session while this one waited. Adopt it
            // only when that tab also replaced the key under this one. Within
            // one tab, a call without an id refreshes the current session and
            // an inactive id stays an error. Callers should still compare the
            // identity: the other tab may have signed in to a different account.
            if (activeSession.stamperType === 'apiKey') {
              const keyBefore = await client.apiKeyStamper.getPublicKey()
              await client.apiKeyStamper.reload?.()
              const activePublicKey = await client.apiKeyStamper.getPublicKey()
              if (
                activePublicKey &&
                normalizeKey(activePublicKey) !==
                  normalizeKey(keyBefore ?? '') &&
                normalizeKey(activePublicKey) ===
                  normalizeKey(activeSession.publicKey ?? '') &&
                normalizeTimestamp(activeSession.expiry) > Date.now()
              ) {
                return activeSession
              }
            }
            if (sessionId !== undefined) {
              throw new Error(
                'Refreshing an inactive session is not supported with a single active key vault',
              )
            }
          }
          if (activeSession.stamperType !== 'apiKey') {
            throw new Error('Invalid session type')
          }

          const targetPublicKey = await prepareFreshKeyRotation()
          try {
            const data = await client.loginWithStamp({
              targetPublicKey,
              projectId,
              // Stamp-login is signed against the Turnkey parent org; the backend
              // resolves the sub-org from the stamped credential. Signing the
              // sub-org here makes the relayed payload's org mismatch the
              // signature → Turnkey SIGNATURE_INVALID.
              organizationId: await resolveOrganizationId(),
              stampWith: 'apiKey',
            })
            const session = createReplacementSession(
              data.session,
              targetPublicKey,
              'indexedDb',
              SessionType.READ_WRITE,
            )
            await commitReplacementSessionLocked(session, targetPublicKey)
            return session
          } catch (error) {
            await client.apiKeyStamper.discardKeyRotation()
            throw error
          }
        }),
      )
    },

    // [TODO] refactor to smaller utils/actions
    async auth(params: AuthParams) {
      switch (params.type) {
        case 'oauth': {
          return withKeyTransition(async () => {
            const targetPublicKey =
              preparedOAuthPublicKey ??
              (await client.apiKeyStamper.prepareKeyRotation())
            preparedOAuthPublicKey = undefined
            try {
              const popSignature = await client.apiKeyStamper.signPending(
                params.sessionId,
              )
              const data = await client.authenticateWithOAuth({
                provider: params.provider,
                projectId,
                sessionId: params.sessionId,
                popSignature,
              })

              if (!data.session) {
                await client.apiKeyStamper.discardKeyRotation()
                return data
              }
              const session = createReplacementSession(
                data.session,
                targetPublicKey,
                'oauth',
              )
              await commitReplacementSession(session, targetPublicKey)
              return data
            } catch (error) {
              await client.apiKeyStamper.discardKeyRotation()
              throw error
            }
          })
        }
        case 'passkey': {
          const { type } = params
          if (
            type === 'passkey' &&
            'mode' in params &&
            params.mode === 'register'
          ) {
            return withKeyTransition(async () => {
              if (await sessionStorageManager.getActiveSession()) {
                throw new Error(
                  'Passkey registration requires an unauthenticated wallet; logout before registering a new wallet.',
                )
              }
              const registrationPublicKey = await prepareFreshKeyRotation()
              try {
                const name = `ZeroDevWallet-${humanReadableDateTime()}`
                const { attestation, encodedChallenge } =
                  await passkeyStamper.register({
                    rp: { id: rpId, name: 'ZeroDev Wallet' },
                    userName: name,
                  })
                const data = await client.registerWithPasskey({
                  attestation,
                  challenge: encodedChallenge,
                  projectId,
                  encodedPublicKey: registrationPublicKey,
                })

                // From here the shared vault changes, so hold the cross-tab
                // lock; the passkey prompt above stays outside it.
                return await withCrossTabLock(async () => {
                  // Registration proves the temporary key exists remotely. Make
                  // it active so it can authorize the durable replacement key.
                  await client.apiKeyStamper.commitKeyRotation()
                  const targetPublicKey = await prepareFreshKeyRotation()
                  const loginData = await client.loginWithStamp({
                    projectId,
                    targetPublicKey,
                    // Sign against the parent org (see refreshSession note) — the
                    // backend derives the sub-org from the stamped credential.
                    organizationId: await resolveOrganizationId(),
                  })
                  const session = createReplacementSession(
                    loginData.session,
                    targetPublicKey,
                    'indexedDb',
                  )
                  await commitReplacementSessionLocked(session, targetPublicKey)
                  return data
                })
              } catch (error) {
                await client.apiKeyStamper.discardKeyRotation()
                throw error
              }
            })
          }
          if (
            type === 'passkey' &&
            'mode' in params &&
            params.mode === 'login'
          ) {
            return withKeyTransition(async () => {
              const targetPublicKey = await prepareFreshKeyRotation()
              try {
                const loginData = await client.loginWithStamp({
                  targetPublicKey,
                  projectId,
                  // Sign against the parent org, not the user's sub-org (see the
                  // refreshSession note). The backend derives the sub-org from the
                  // stamped passkey credential.
                  organizationId: await resolveOrganizationId(),
                  stampWith: 'passkey',
                })
                const session = createReplacementSession(
                  loginData.session,
                  targetPublicKey,
                  'indexedDb',
                )
                await commitReplacementSession(session, targetPublicKey)
                return loginData
              } catch (error) {
                await client.apiKeyStamper.discardKeyRotation()
                throw error
              }
            })
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
            return withKeyTransition(async () => {
              const { otpId, otpCode, otpEncryptionTargetBundle } = otpParams
              const targetPublicKey = await prepareFreshKeyRotation()

              try {
                // HPKE-seal the OTP attempt to the enclave's per-session target
                // key. The auth proxy never sees the plaintext OTP code.
                const encryptedOtpBundle = await encryptOtpAttempt({
                  otpCode,
                  publicKey: targetPublicKey,
                  encryptionTargetBundle: otpEncryptionTargetBundle,
                })

                if (!cachedAuthProxyConfigId) {
                  const { authProxyConfigId } =
                    await client.getAuthProxyConfigId()
                  cachedAuthProxyConfigId = authProxyConfigId
                }
                const authProxyClient = createAuthProxyClient({
                  authProxyConfigId: cachedAuthProxyConfigId,
                })

                const { verificationToken } = await authProxyClient.verifyOtp({
                  otpId,
                  encryptedOtpBundle,
                })

                const clientSignature = await buildClientSignature({
                  verificationToken,
                  publicKey: targetPublicKey,
                  stamper: {
                    stamp: (payload) =>
                      client.apiKeyStamper.stampPending(payload),
                  },
                })

                const data = await client.loginWithOTP({
                  verificationToken,
                  clientSignature,
                  projectId,
                })

                if (!data.session) {
                  await client.apiKeyStamper.discardKeyRotation()
                  return data
                }
                const session = createReplacementSession(
                  data.session,
                  targetPublicKey,
                  'otp',
                )
                await commitReplacementSession(session, targetPublicKey)
                return data
              } catch (error) {
                await client.apiKeyStamper.discardKeyRotation()
                throw error
              }
            })
          }

          throw new Error('OTP authentication requires mode parameter')
        }
        default:
          throw new Error(`Unknown auth type: ${(params as any).type}`)
      }
    },

    async logout(options) {
      return withKeyTransition(async () => {
        const session = await sessionStorageManager.getActiveSession()
        if (session) {
          const publicKey = await client.apiKeyStamper.getPublicKey()
          if (publicKey) {
            try {
              const authenticators = await client.getAuthenticators({
                subOrganizationId: session.organizationId,
                projectId,
                token: session.token,
              })
              const sessionKey = authenticators.sessionKeys?.find((key) => {
                const candidate = key.ApiKey ?? key.apiKey
                return (
                  candidate !== undefined &&
                  normalizeKey(candidate) === normalizeKey(publicKey)
                )
              })
              const apiKeyId = sessionKey?.TurnkeyId ?? sessionKey?.turnkeyId
              if (!apiKeyId) {
                throw new Error(
                  'Current session key was not found in the authenticated key list; refusing to erase local credentials without confirmed remote revocation.',
                )
              }
              await client.logout({
                projectId,
                organizationId: session.organizationId,
                userId: session.userId,
                apiKeyId,
              })
            } catch (error) {
              // Only a confirmed rejection (401) or an explicit `force` clears
              // local credentials below. Any other failure (403, 5xx, network)
              // is ambiguous — erasing the only key on an inconclusive signal
              // could lock the user out unrecoverably — so preserve it and
              // return without throwing, so callers (e.g. a logout button)
              // don't crash. Pass `logout({ force: true })` to clear locally
              // regardless when the caller knows the remote is gone.
              const credentialIsRejected =
                error instanceof RestRequestError && error.status === 401
              if (!options?.force && !credentialIsRejected) return false
            }
          }
        }

        preparedOAuthPublicKey = undefined
        return withCrossTabLock(async () => {
          // Another tab may have signed in while the revoke was in flight. Keep
          // a session for a different account, or one that appeared after a
          // signed-out start; a same-account refresh is still ours to clear.
          const current = await sessionStorageManager.getActiveSession()
          if (
            current &&
            (!session ||
              current.organizationId !== session.organizationId ||
              current.userId !== session.userId)
          ) {
            await client.apiKeyStamper.discardKeyRotation()
            return true
          }
          let cleanupError: unknown
          try {
            await client.apiKeyStamper.clear()
          } catch (error) {
            cleanupError = error
          }
          try {
            await sessionStorageManager.clearAllSessions()
          } catch (error) {
            cleanupError ??= error
          }
          if (cleanupError) throw cleanupError
          return true
        })
      })
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
          if (!activeSession?.token) {
            throw new Error(
              'No active session token; refusing to build an account without authentication.',
            )
          }
          return activeSession.token
        },
      })
    },
  }
}
