import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import {
  createIframeStamper,
  exportPrivateKey as exportPrivateKeySdk,
  exportWallet as exportWalletSdk,
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
  parameters: {
    email: string
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  await wallet.auth({
    type: 'passkey',
    email: parameters.email,
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
  type Parameters = {
    email: string
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
  parameters: {
    email: string
    connector?: Connector
  },
): Promise<void> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  await wallet.auth({
    type: 'passkey',
    email: parameters.email,
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
  type Parameters = {
    email: string
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
  // Use current origin as redirect - SDK auto-detects callback on any page
  const oauthUrl = buildBackendOAuthUrl({
    provider: parameters.provider,
    backendUrl: oauthConfig.backendUrl,
    projectId: oauthConfig.projectId,
    publicKey,
    returnTo: `${window.location.origin}?oauth_success=true&oauth_provider=${parameters.provider}`,
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
      async () => {
        try {
          // Complete OAuth authentication with wallet-core
          // The backend has stored the OAuth session in a cookie
          await wallet.auth({
            type: 'oauth',
            provider: parameters.provider,
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
    connector?: Connector
  },
): Promise<{ otpId: string; subOrganizationId: string }> {
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
  })

  return {
    otpId: result.otpId,
    subOrganizationId: result.subOrganizationId,
  }
}

export declare namespace sendOTP {
  type Parameters = {
    email: string
    emailCustomization?: { magicLinkTemplate?: string }
    connector?: Connector
  }
  type ReturnType = { otpId: string; subOrganizationId: string }
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
    subOrganizationId: string
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
    subOrganizationId: parameters.subOrganizationId,
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
    subOrganizationId: string
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
 * Get user email
 */
export async function getUserEmail(
  config: Config,
  parameters: {
    organizationId: string
    projectId: string
    connector?: Connector
  },
): Promise<{ email: string }> {
  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet

  if (!wallet) throw new Error('Wallet not initialized')

  // Call the core SDK method
  return await wallet.client.getUserEmail({
    organizationId: parameters.organizationId,
    projectId: parameters.projectId,
  })
}

export declare namespace getUserEmail {
  type Parameters = {
    organizationId: string
    projectId: string
    connector?: Connector
  }
  type ReturnType = { email: string }
  type ErrorType = Error
}

/**
 * Export wallet
 */
export async function exportWallet(
  config: Config,
  parameters: {
    iframeContainerId: string
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
    address?: string
    keyFormat?: 'Hexadecimal' | 'Solana'
    connector?: Connector
  }
  type ReturnType = void
  type ErrorType = Error
}
