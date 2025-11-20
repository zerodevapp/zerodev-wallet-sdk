import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import type { OAuthProvider } from './oauth.js'
import {
  buildOAuthUrl,
  generateOAuthNonce,
  openOAuthPopup,
  pollOAuthPopup,
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
 */
export async function authenticateOAuth(
  config: Config,
  parameters: {
    provider: OAuthProvider
    clientId?: string
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
    throw new Error(
      'OAuth is not configured. Please provide oauthConfig to zeroDevWallet connector.',
    )
  }

  // Get client ID for the provider
  let clientId = parameters.clientId
  if (!clientId) {
    clientId = oauthConfig.googleClientId
  }

  if (!clientId) {
    throw new Error(`Client ID not configured for ${parameters.provider}`)
  }

  if (!oauthConfig.redirectUri) {
    throw new Error('OAuth redirect URI is not configured.')
  }

  // Generate nonce from wallet public key
  const publicKey = await wallet.getPublicKey()
  if (!publicKey) {
    throw new Error('Failed to get wallet public key')
  }
  const nonce = generateOAuthNonce(publicKey)

  // Build OAuth URL
  const oauthUrl = buildOAuthUrl({
    provider: parameters.provider,
    clientId,
    redirectUri: oauthConfig.redirectUri,
    nonce,
  })

  // Open popup
  const authWindow = openOAuthPopup(oauthUrl)

  if (!authWindow) {
    throw new Error(`Failed to open ${parameters.provider} login window.`)
  }

  // Poll for OAuth completion
  return new Promise<void>((resolve, reject) => {
    pollOAuthPopup(
      authWindow,
      window.location.origin,
      async (idToken) => {
        try {
          // Complete OAuth authentication with wallet-core
          await wallet.auth({
            type: 'oauth',
            provider: parameters.provider,
            credential: idToken,
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
      reject,
    )
  })
}

export declare namespace authenticateOAuth {
  type Parameters = {
    provider: OAuthProvider
    clientId?: string
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

  const { exportWallet: exportWalletSdk, createIframeStamper } = await import(
    '@zerodev/wallet-core'
  )

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
