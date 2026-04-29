import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import {
  createIframeStamper,
  exportPrivateKey as exportPrivateKeySdk,
  exportWallet as exportWalletSdk,
  type GetAuthenticatorsReturnType,
} from '@zerodev/wallet-core'
import type { OAuthProvider } from './oauth.js'
import {
  buildBackendOAuthUrl,
  listenForOAuthMessage,
  openOAuthPopup,
} from './oauth.js'

/**
 * Get ZeroDev connector from config
 */
function getZeroDevConnector(config: Config): Connector {
  const connector = config.connectors.find((c) => c.id === 'zerodev-wallet')
  if (!connector) {
    throw new Error('ZeroDev connector not found in Wagmi config')
  }
  return connector
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

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

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

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

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
 * Authenticate with OAuth (opens popup)
 * Uses backend OAuth flow where the backend handles PKCE and token exchange
 */
export async function authenticateOAuth(
  config: Config,
  parameters: {
    provider: OAuthProvider
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet
  const oauthConfig = store.getState().oauthConfig

  if (!wallet) throw new Error('Wallet not initialized')
  if (!oauthConfig) {
    throw new Error('Wallet not initialized. Please wait for connector setup.')
  }

  // Get wallet public key for the OAuth flow
  const publicKey = await wallet.getPublicKey()
  if (!publicKey) {
    throw new Error('Failed to get wallet public key')
  }

  // Build OAuth URL that redirects to backend
  // Preserve the caller's full path so the popup lands on the same route
  // (e.g. /dashboard) where the SDK is mounted, not just the origin.
  const returnUrl = new URL(window.location.href)
  returnUrl.hash = ''
  returnUrl.searchParams.set('oauth_success', 'true')
  returnUrl.searchParams.set('oauth_provider', parameters.provider)

  const oauthUrl = buildBackendOAuthUrl({
    provider: parameters.provider,
    backendUrl: oauthConfig.backendUrl,
    projectId: oauthConfig.projectId,
    publicKey,
    returnTo: returnUrl.toString(),
  })

  // Open popup
  const authWindow = openOAuthPopup(oauthUrl)

  if (!authWindow) {
    throw new Error(`Failed to open ${parameters.provider} login window.`)
  }

  // Listen for OAuth completion via postMessage
  return new Promise<void>((resolve, reject) => {
    const cleanup = listenForOAuthMessage(
      authWindow,
      window.location.origin,
      async (sessionId) => {
        try {
          // Complete OAuth authentication with wallet-core
          await wallet.auth({
            type: 'oauth',
            provider: parameters.provider,
            sessionId,
          })

          const [session, eoaAccount] = await Promise.all([
            wallet.getSession(),
            wallet.toAccount(),
          ])

          store.getState().setEoaAccount(eoaAccount)
          store.getState().setSession(session || null)

          // Auto-connect to Wagmi
          await wagmiConnect(config, { connector })

          resolve()
        } catch (err) {
          reject(err)
        }
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

export declare namespace authenticateOAuth {
  type Parameters = {
    provider: OAuthProvider
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
): Promise<{ otpId: string }> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

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
  }
}

export declare namespace sendOTP {
  type Parameters = {
    email: string
    emailCustomization?: { magicLinkTemplate?: string }
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  }
  type ReturnType = { otpId: string }
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
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  await wallet.auth({
    type: 'otp',
    mode: 'verifyOtp',
    otpId: parameters.otpId,
    otpCode: parameters.code,
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

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet
  const currentSession = store.getState().session

  if (!wallet || !currentSession) {
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

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

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
 * Export wallet
 */
export async function exportWallet(
  config: Config,
  parameters: {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  const iframeContainer = document.getElementById(parameters.iframeContainerId)
  if (!iframeContainer) {
    throw new Error('Iframe container not found')
  }

  const iframeStamper = await createIframeStamper({
    iframeUrl: 'https://export.turnkey.com',
    iframeContainer,
    iframeElementId: 'export-wallet-iframe',
  })

  const publicKey = await iframeStamper.init()

  if (parameters.iframeStyles) {
    await iframeStamper.applySettings({ styles: parameters.iframeStyles })
  }

  const { exportBundle, organizationId } = await exportWalletSdk({
    wallet,
    targetPublicKey: publicKey,
  })

  const success = await iframeStamper.injectWalletExportBundle(
    exportBundle,
    organizationId,
  )
  if (success !== true) {
    throw new Error('Failed to inject export bundle')
  }
}

export declare namespace exportWallet {
  type Parameters = {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}

/**
 * Export private key
 */
export async function exportPrivateKey(
  config: Config,
  parameters: {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    address?: string
    keyFormat?: 'Hexadecimal' | 'Solana'
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  const iframeContainer = document.getElementById(parameters.iframeContainerId)
  if (!iframeContainer) {
    throw new Error('Iframe container not found')
  }

  const iframeStamper = await createIframeStamper({
    iframeUrl: 'https://export.turnkey.com',
    iframeContainer,
    iframeElementId: 'export-private-key-iframe',
  })

  const publicKey = await iframeStamper.init()

  if (parameters.iframeStyles) {
    await iframeStamper.applySettings({ styles: parameters.iframeStyles })
  }

  const { exportBundle, organizationId } = await exportPrivateKeySdk({
    wallet,
    targetPublicKey: publicKey,
    ...(parameters.address && { address: parameters.address }),
  })

  const success = await iframeStamper.injectKeyExportBundle(
    exportBundle,
    organizationId,
    parameters.keyFormat ?? 'Hexadecimal',
  )
  if (success !== true) {
    throw new Error('Failed to inject export bundle')
  }
}

export declare namespace exportPrivateKey {
  type Parameters = {
    iframeContainerId: string
    iframeStyles?: Record<string, string>
    address?: string
    keyFormat?: 'Hexadecimal' | 'Solana'
    connector?: Connector
  }
  type ReturnType = void
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
): Promise<{ otpId: string }> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

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
  }
}

export declare namespace sendMagicLink {
  type Parameters = {
    email: string
    redirectURL: string
    otpCodeCustomization?: { length: 6 | 7 | 8 | 9; alphanumeric: boolean }
    connector?: Connector
  }
  type ReturnType = { otpId: string }
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
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  await wallet.auth({
    type: 'magicLink',
    mode: 'verify',
    otpId: parameters.otpId,
    code: parameters.code,
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
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}
