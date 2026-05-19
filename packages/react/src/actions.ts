import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import type {
  GetAuthenticatorsReturnType,
  ZeroDevWalletSDK,
} from '@zerodev/wallet-core'
import type { createZeroDevWalletStore } from './store.js'

type ZeroDevStore = ReturnType<typeof createZeroDevWalletStore>

/**
 * Get ZeroDev connector from config
 */
export function getZeroDevConnector(config: Config): Connector {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector) {
    throw new Error('ZeroDev connector not found in Wagmi config')
  }
  return connector
}

/**
 * Get the typed ZeroDev store from a connector. Centralises the
 * `@ts-expect-error` cast for the connector's custom `getStore` method.
 */
export async function getZeroDevStore(
  connector: Connector,
): Promise<ZeroDevStore> {
  // @ts-expect-error - getStore is a custom method on the ZeroDev connector
  return (await connector.getStore()) as ZeroDevStore
}

/**
 * Read the initialised wallet from a ZeroDev store. Throws
 * `'Wallet not initialized'` when the connector's setup hasn't run yet.
 */
export function getZeroDevWallet(store: ZeroDevStore): ZeroDevWalletSDK {
  const wallet = store.getState().wallet
  if (!wallet) throw new Error('Wallet not initialized')
  return wallet
}

/**
 * Register with passkey
 */
export async function registerPasskey(
  config: Config,
  parameters?: {
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters?.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  await wallet.auth({
    type: 'passkey',
    mode: 'register',
  })

  const [session, eoaAccount] = await Promise.all([
    wallet.getSession(),
    wallet.toAccount(),
  ])

  store.getState().setEoaAccount(eoaAccount)
  store.getState().setSession(session || null)

  // Auto-connect to Wagmi
  await wagmiConnect(config, { connector })
}

export declare namespace registerPasskey {
  type Parameters = void | {
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}

/**
 * Login with passkey
 */
export async function loginPasskey(
  config: Config,
  parameters?: {
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters?.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  await wallet.auth({
    type: 'passkey',
    mode: 'login',
  })

  const [session, eoaAccount] = await Promise.all([
    wallet.getSession(),
    wallet.toAccount(),
  ])

  store.getState().setEoaAccount(eoaAccount)
  store.getState().setSession(session || null)

  // Auto-connect to Wagmi
  await wagmiConnect(config, { connector })
}

export declare namespace loginPasskey {
  type Parameters = void | {
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}

/**
 * Send OTP via email
 */
export async function sendOTP(
  config: Config,
  parameters: {
    email: string
    emailCustomization?: { magicLinkTemplate?: string }
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  },
): Promise<{ otpId: string; otpEncryptionTargetBundle: string }> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  const result = await wallet.auth({
    type: 'otp',
    mode: 'sendOtp',
    email: parameters.email,
    contact: { type: 'email', contact: parameters.email },
    ...(parameters.emailCustomization && {
      emailCustomization: parameters.emailCustomization,
    }),
    ...(parameters.otpCodeCustomization && {
      otpCodeCustomization: parameters.otpCodeCustomization,
    }),
  })

  return {
    otpId: result.otpId,
    otpEncryptionTargetBundle: result.otpEncryptionTargetBundle,
  }
}

export declare namespace sendOTP {
  type Parameters = {
    email: string
    emailCustomization?: { magicLinkTemplate?: string }
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  }
  type ReturnType = { otpId: string; otpEncryptionTargetBundle: string }
  type ErrorType = Error
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  config: Config,
  parameters: {
    code: string
    otpId: string
    /** Encryption target bundle returned by the matching `sendOTP` call. */
    otpEncryptionTargetBundle: string
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  await wallet.auth({
    type: 'otp',
    mode: 'verifyOtp',
    otpId: parameters.otpId,
    otpCode: parameters.code,
    otpEncryptionTargetBundle: parameters.otpEncryptionTargetBundle,
  })

  const [session, eoaAccount] = await Promise.all([
    wallet.getSession(),
    wallet.toAccount(),
  ])

  store.getState().setEoaAccount(eoaAccount)
  store.getState().setSession(session || null)

  // Auto-connect to Wagmi
  await wagmiConnect(config, { connector })
}

export declare namespace verifyOTP {
  type Parameters = {
    code: string
    otpId: string
    otpEncryptionTargetBundle: string
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}

/**
 * Refresh session
 */
export async function refreshSession(
  config: Config,
  parameters: {
    connector?: Connector
  } = {},
): Promise<unknown> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)
  const currentSession = store.getState().session

  if (!currentSession) {
    throw new Error('No active session to refresh')
  }

  const newSession = await wallet.refreshSession(currentSession.id)
  store.getState().setSession(newSession || null)
  return newSession
}

export declare namespace refreshSession {
  type Parameters = {
    connector?: Connector
  }
  type ReturnType = unknown
  type ErrorType = Error
}

/**
 * Fetch all authenticators (oauths, passkeys, emailContacts, apiKeys)
 * for the current user within the connected project/sub-organization.
 */
export async function getAuthenticators(
  config: Config,
): Promise<GetAuthenticatorsReturnType> {
  const connector = getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  const oauthConfig = store.getState().oauthConfig
  if (!oauthConfig) {
    throw new Error('Wallet not initialized. Please wait for connector setup.')
  }

  const session = store.getState().session
  if (!session) {
    throw new Error('No active session')
  }

  // Call the core SDK method
  return await wallet.client.getAuthenticators({
    subOrganizationId: session.organizationId,
    projectId: oauthConfig.projectId,
    token: session.token,
  })
}

export declare namespace getAuthenticators {
  type Parameters = {
    connector?: Connector
  }
  type ReturnType = GetAuthenticatorsReturnType
  type ErrorType = Error
}

/**
 * Send magic link via email
 */
export async function sendMagicLink(
  config: Config,
  parameters: {
    email: string
    redirectURL: string
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  },
): Promise<{ otpId: string; otpEncryptionTargetBundle: string }> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  const result = await wallet.auth({
    type: 'magicLink',
    mode: 'send',
    email: parameters.email,
    redirectURL: parameters.redirectURL,
    ...(parameters.otpCodeCustomization && {
      otpCodeCustomization: parameters.otpCodeCustomization,
    }),
  })

  return {
    otpId: result.otpId,
    otpEncryptionTargetBundle: result.otpEncryptionTargetBundle,
  }
}

export declare namespace sendMagicLink {
  type Parameters = {
    email: string
    redirectURL: string
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  }
  type ReturnType = { otpId: string; otpEncryptionTargetBundle: string }
  type ErrorType = Error
}

/**
 * Verify magic link code
 */
export async function verifyMagicLink(
  config: Config,
  parameters: {
    otpId: string
    code: string
    /** Encryption target bundle returned by the matching `sendMagicLink` call. */
    otpEncryptionTargetBundle: string
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)

  await wallet.auth({
    type: 'magicLink',
    mode: 'verify',
    otpId: parameters.otpId,
    code: parameters.code,
    otpEncryptionTargetBundle: parameters.otpEncryptionTargetBundle,
  })

  const [session, eoaAccount] = await Promise.all([
    wallet.getSession(),
    wallet.toAccount(),
  ])

  store.getState().setEoaAccount(eoaAccount)
  store.getState().setSession(session || null)

  // Auto-connect to Wagmi
  await wagmiConnect(config, { connector })
}

export declare namespace verifyMagicLink {
  type Parameters = {
    otpId: string
    code: string
    otpEncryptionTargetBundle: string
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}
