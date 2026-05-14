import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import type { createZeroDevWallet } from '@zerodev/wallet-core'
import { getZeroDevConnector } from './actions.js'
import { getSessionIdWeb } from './getSessionIdWeb.js'
import type { createZeroDevWalletStore } from './store.js'
import {
  type OAuthProvider,
  verifyGoogleLoginUrl,
} from './utils/verifyGoogleLoginUrl.js'

/**
 * Pluggable callback for obtaining an OAuth session ID.
 * On web the default popup + parent-polling flow is used.
 * On React Native, pass a function that opens a system browser and
 * resolves with the sessionId extracted from the deep-link redirect.
 */
export type GetOAuthSessionIdFn = (params: {
  oauthUrl: string
  provider: OAuthProvider
}) => Promise<string>

type Wallet = Awaited<ReturnType<typeof createZeroDevWallet>>
type Store = ReturnType<typeof createZeroDevWalletStore>

async function completeOAuth(
  wallet: Wallet,
  store: Store,
  config: Config,
  connector: Connector,
  provider: OAuthProvider,
  sessionId: string,
): Promise<void> {
  await wallet.auth({ type: 'oauth', provider, sessionId })

  const [session, eoaAccount] = await Promise.all([
    wallet.getSession(),
    wallet.toAccount(),
  ])

  store.getState().setEoaAccount(eoaAccount)
  store.getState().setSession(session || null)

  await wagmiConnect(config, { connector })
}

/**
 * Authenticate with OAuth.
 *
 * By default (no `getSessionId`/`redirectUri` provided), uses a built-in web
 * popup + parent-polling flow. Pass `timeoutMs` to configure how long that web
 * popup flow may run before it fails. On native, pass a consumer-supplied
 * `getSessionId` adapter (e.g. using expo-web-browser + expo-linking) plus the
 * `redirectUri` the backend should redirect to. Must be provided together.
 */
export async function authenticateOAuth(
  config: Config,
  parameters: authenticateOAuth.Parameters & authenticateOAuth.AdapterOptions,
): Promise<void> {
  const { provider, getSessionId, redirectUri, timeoutMs } = parameters

  if (Boolean(redirectUri) !== Boolean(getSessionId)) {
    throw new Error('redirectUri and getSessionId must be provided together')
  }

  const connector = parameters.connector ?? getZeroDevConnector(config)

  // @ts-expect-error - getStore is a custom method
  const store = await connector.getStore()
  const wallet = store.getState().wallet
  const oauthConfig = store.getState().oauthConfig

  if (!wallet) throw new Error('Wallet not initialized')
  if (!oauthConfig) {
    throw new Error('Wallet not initialized. Please wait for connector setup.')
  }

  const publicKey = await wallet.getPublicKey()
  if (!publicKey) {
    throw new Error('Failed to get wallet public key')
  }

  // Build OAuth URL that redirects to backend
  // Preserve the caller's full path so the popup lands on the same route
  // (e.g. /dashboard) where the SDK is mounted, not just the origin.
  const returnUrl = new URL(redirectUri ?? window.location.href)
  returnUrl.hash = ''
  returnUrl.searchParams.set('oauth_success', 'true')
  returnUrl.searchParams.set('oauth_provider', provider)

  // Fetch the Google OAuth URL from the backend, then verify its `nonce`
  // matches sha256(pub_key) before handing it to any adapter. Audit finding
  // TOB-KMS-1: the backend is not a trusted party, so the SDK must bind the
  // OIDC flow to its own pubkey rather than trust whatever URL it receives.
  // Verification runs before the adapter is invoked, so both web and native
  // paths receive an already-verified URL.
  const oauthUrl = await wallet.client.getOAuthLoginUrl({
    provider,
    projectId: oauthConfig.projectId,
    publicKey,
    returnTo: returnUrl.toString(),
  })
  verifyGoogleLoginUrl(oauthUrl, publicKey)

  const sessionId = getSessionId
    ? await getSessionId({ oauthUrl, provider })
    : await getSessionIdWeb(oauthUrl, window.location.origin, timeoutMs)

  await completeOAuth(wallet, store, config, connector, provider, sessionId)
}

export declare namespace authenticateOAuth {
  type Parameters = {
    provider: OAuthProvider
    connector?: Connector
  }
  type AdapterOptions = {
    getSessionId?: GetOAuthSessionIdFn
    redirectUri?: string
    timeoutMs?: number
  }
  type ReturnType = void
  type ErrorType = Error
}
