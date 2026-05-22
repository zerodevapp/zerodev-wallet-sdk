import type { Config, Connector } from '@wagmi/core'
import { connect as wagmiConnect } from '@wagmi/core/actions'
import type { createZeroDevWallet } from '@zerodev/wallet-core'
import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from './actions.js'
import type { createZeroDevWalletStore } from './store.js'
import {
  type OAuthProvider,
  verifyGoogleLoginUrl,
} from './utils/verifyGoogleLoginUrl.js'

/**
 * Pluggable callback for obtaining an OAuth session ID. The web hook supplies
 * a popup + parent-polling flow (`getSessionIdWeb`); the RN hook requires
 * consumer-supplied adapters (e.g. expo-web-browser + expo-linking).
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
 * Platform-agnostic OAuth orchestration core. REQUIRES both `getSessionId`
 * and `redirectUri` — no web-fallback defaults at this layer. The web hook
 * supplies `getSessionIdWeb` + `window.location.href`; the native hook
 * supplies its own adapter pair.
 */
export async function authenticateOAuth(
  config: Config,
  parameters: authenticateOAuth.Parameters,
): Promise<void> {
  const { provider, getSessionId, redirectUri } = parameters
  const connector = parameters.connector ?? getZeroDevConnector(config)
  const store = await getZeroDevStore(connector)
  const wallet = getZeroDevWallet(store)
  const oauthConfig = store.getState().oauthConfig

  if (!oauthConfig) {
    throw new Error('Wallet not initialized. Please wait for connector setup.')
  }

  const publicKey = await wallet.getPublicKey()
  if (!publicKey) {
    throw new Error('Failed to get wallet public key')
  }

  const returnUrl = new URL(redirectUri)
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

  const sessionId = await getSessionId({ oauthUrl, provider })

  await completeOAuth(wallet, store, config, connector, provider, sessionId)
}

export declare namespace authenticateOAuth {
  type Parameters = {
    provider: OAuthProvider
    connector?: Connector
    getSessionId: GetOAuthSessionIdFn
    redirectUri: string
  }
  type ReturnType = void
  type ErrorType = Error
}
