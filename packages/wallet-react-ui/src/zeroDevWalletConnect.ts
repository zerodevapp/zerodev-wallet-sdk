import type { CreateConnectorFn } from 'wagmi'
import { type WalletConnectParameters, walletConnect } from 'wagmi/connectors'
import { isMobile } from './auth/utils/isMobile'

/**
 * localStorage key `@walletconnect/sign-client` reads before publishing each
 * session request — when set, the SDK deep-links back into the chosen wallet
 * app (`{href}/wc?requestId=…&sessionTopic=…`) so the approval prompt is in
 * front of the user. Same key AppKit writes; the SDK no-ops when it's absent.
 */
const DEEPLINK_CHOICE_KEY = 'WALLETCONNECT_DEEPLINK_CHOICE'

/** The slice of `@walletconnect/ethereum-provider` this module touches. */
type WcSessionProvider = {
  on: (event: 'connect' | 'disconnect', listener: () => void) => unknown
  session?: {
    peer?: {
      metadata?: { name?: string; redirect?: { native?: string } }
    }
  }
}

const watched = new WeakSet<object>()

/**
 * Arm the SDK's redirect-on-request with the connected wallet's own
 * registered scheme (`session.peer.metadata.redirect.native`) — authoritative
 * for whichever wallet actually claimed the pairing. Desktop sessions and
 * wallets that register no native redirect stay unarmed.
 */
function storeDeepLinkChoice(provider: WcSessionProvider) {
  const metadata = provider.session?.peer?.metadata
  const href = metadata?.redirect?.native
  if (!href || !isMobile()) {
    clearDeepLinkChoice()
    return
  }
  try {
    localStorage.setItem(
      DEEPLINK_CHOICE_KEY,
      JSON.stringify({ href, name: metadata?.name ?? '' }),
    )
  } catch {
    // Storage unavailable — requests still work, minus the app hop.
  }
}

function clearDeepLinkChoice() {
  try {
    localStorage.removeItem(DEEPLINK_CHOICE_KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

function watchSession(provider: WcSessionProvider) {
  if (watched.has(provider)) return
  watched.add(provider)
  provider.on('connect', () => storeDeepLinkChoice(provider))
  // A stale choice would deep-link a future session to the wrong app.
  provider.on('disconnect', clearDeepLinkChoice)
  // Session restored from storage (page reload) — re-arm without an event.
  if (provider.session) storeDeepLinkChoice(provider)
}

/**
 * WalletConnect connector preconfigured for the kit. `showQrModal: false` is
 * required — the kit renders its own pairing UI, and WalletConnect's bundled
 * Reown modal would pop over it otherwise. All other WalletConnect
 * parameters (e.g. `metadata`) are forwarded as-is.
 *
 * The kit only pairs through connectors created here — a raw `walletConnect()`
 * in the config is ignored, since its `showQrModal` can't be read back.
 */
export type ZeroDevWalletConnectParams = Omit<
  WalletConnectParameters,
  'showQrModal'
> & {
  /**
   * Also offer Solana wallets over WalletConnect (`SignUp.SolanaWalletConnect`
   * and a silent restore of that session). Opens a second session with the
   * same project id and metadata; the SDK is loaded only when this is on.
   */
  solana?: boolean | undefined
}

/** What the Solana side reads back off a stamped connector: the connector's
 * own parameters, so its session is configured exactly like the EVM one. */
export type ZeroDevWalletConnectStamp = {
  zdWalletConnect: true
  zdWalletConnectParams: ZeroDevWalletConnectParams
}

export function zeroDevWalletConnect(
  params: ZeroDevWalletConnectParams,
): CreateConnectorFn {
  if (!params.projectId) {
    throw new Error('zeroDevWalletConnect requires a WalletConnect projectId')
  }
  const { solana: _solana, ...wcParams } = params
  const create = walletConnect({ ...wcParams, showQrModal: false })
  return (config) => {
    // Stamp the connector instance so the kit's discovery can tell a
    // correctly-configured connector from a raw walletConnect(), where
    // showQrModal defaults to true, and so the Solana side can open its own
    // session with the same configuration.
    const stamp: ZeroDevWalletConnectStamp = {
      zdWalletConnect: true,
      zdWalletConnectParams: params,
    }
    const connector = Object.assign(create(config), stamp)
    const getProvider = connector.getProvider.bind(connector)
    connector.getProvider = async (...args: Parameters<typeof getProvider>) => {
      const provider = await getProvider(...args)
      watchSession(provider as WcSessionProvider)
      return provider
    }
    return connector
  }
}
