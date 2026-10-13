import {
  isSolanaChain,
  SOLANA_DEVNET_CHAIN,
  SOLANA_MAINNET_CHAIN,
  type SolanaChain,
} from '@solana/wallet-standard-chains'
import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features'
import type {
  IdentifierString,
  WalletAccount,
  WalletIcon,
} from '@wallet-standard/base'
import type {
  StandardConnectFeature,
  StandardDisconnectFeature,
  StandardEventsFeature,
  StandardEventsListeners,
} from '@wallet-standard/features'
import { walletConnectLogo } from '../../auth/brandAssets'
import type { SolanaStandardWallet } from '../types'
import {
  caip2ToSolanaChain,
  parseSessionAccount,
  SOLANA_WALLETCONNECT_CHAINS,
  SOLANA_WALLETCONNECT_EVENTS,
  SOLANA_WALLETCONNECT_METHODS,
} from './chains'
import { base58, base64, withSignature } from './transaction'

/** The slice of a WalletConnect session this module reads. */
export type SolanaWcSession = {
  namespaces: Record<string, { accounts: string[] }>
  peer: { metadata: { name?: string; icons?: string[] } }
}

/** The slice of `@walletconnect/universal-provider` this module drives.
 * Structural so tests can stand in a fake. */
export type SolanaWcProvider = {
  session?: SolanaWcSession | undefined
  connect: (opts: {
    optionalNamespaces: Record<
      string,
      { chains: string[]; methods: string[]; events: string[] }
    >
  }) => Promise<unknown>
  disconnect: () => Promise<void>
  request: (
    args: { method: string; params: Record<string, unknown> },
    chain?: string,
  ) => Promise<unknown>
  on: (event: string, listener: (...args: unknown[]) => void) => unknown
  off: (event: string, listener: (...args: unknown[]) => void) => unknown
  abortPairingAttempt?: () => void
}

const ACCOUNT_FEATURES = [
  'solana:signMessage',
  'solana:signTransaction',
  'solana:signAndSendTransaction',
] as const

type SessionAccount = WalletAccount & {
  /** The CAIP-2 ids the wallet approved this account on, keyed by the
   * Wallet Standard chain they map to: requests must name the id the
   * wallet knows, deprecated or not. */
  readonly caip2ByChain: ReadonlyMap<SolanaChain, string>
}

function accountsOf(session: SolanaWcSession | undefined): SessionAccount[] {
  const byAddress = new Map<string, Map<SolanaChain, string>>()
  for (const entry of session?.namespaces.solana?.accounts ?? []) {
    const parsed = parseSessionAccount(entry)
    if (!parsed) continue
    const chain = caip2ToSolanaChain(parsed.caip2)
    if (!chain) continue
    const chains = byAddress.get(parsed.address) ?? new Map()
    if (!chains.has(chain)) chains.set(chain, parsed.caip2)
    byAddress.set(parsed.address, chains)
  }
  return [...byAddress.entries()].map(([address, caip2ByChain]) => ({
    address,
    publicKey: base58.decode(address),
    chains: [...caip2ByChain.keys()],
    features: ACCOUNT_FEATURES,
    caip2ByChain,
  }))
}

const wallets = new WeakMap<SolanaWcProvider, SolanaStandardWallet>()
const providersByWallet = new WeakMap<object, SolanaWcProvider>()

/** True for a wallet made by `getSolanaWalletConnectWallet`. */
export function isSolanaWalletConnectWallet(wallet: object): boolean {
  return providersByWallet.has(wallet)
}

/** The provider behind a WalletConnect wallet, for the pairing UI. */
export function providerOfSolanaWalletConnectWallet(
  wallet: object,
): SolanaWcProvider | undefined {
  return providersByWallet.get(wallet)
}

/**
 * A Wallet Standard wallet backed by a WalletConnect `solana` session, one
 * per provider. The rest of the kit (store slice, hooks, signing handle)
 * then treats a phone wallet exactly like an installed one:
 * `standard:connect` returns the session's accounts, or opens a pairing
 * (the provider emits `display_uri` for the QR) when there is none;
 * `solana:*` signing features relay to the wallet as `solana_*` JSON-RPC.
 */
export function getSolanaWalletConnectWallet(
  provider: SolanaWcProvider,
): SolanaStandardWallet {
  const existing = wallets.get(provider)
  if (existing) return existing

  const accountFor = (account: WalletAccount): SessionAccount => {
    const found = accountsOf(provider.session).find(
      (a) => a.address === account.address,
    )
    if (!found) throw new Error('This account is not in the session')
    return found
  }
  const caip2For = (
    account: SessionAccount,
    chain?: IdentifierString,
  ): string => {
    const target = chain && isSolanaChain(chain) ? chain : account.chains[0]
    const caip2 = target
      ? account.caip2ByChain.get(target as SolanaChain)
      : undefined
    if (!caip2) throw new Error(`The session does not include ${target}`)
    return caip2
  }

  const listeners = new Set<StandardEventsListeners['change']>()
  const emitAccounts = () => {
    const accounts = accountsOf(provider.session)
    for (const listener of listeners) listener({ accounts })
  }
  const emitGone = () => {
    for (const listener of listeners) listener({ accounts: [] })
  }
  let watching = false
  const watch = () => {
    if (watching) return
    watching = true
    provider.on('session_update', emitAccounts)
    provider.on('accountsChanged', emitAccounts)
    provider.on('session_delete', emitGone)
    provider.on('disconnect', emitGone)
  }

  const features: StandardConnectFeature &
    StandardDisconnectFeature &
    StandardEventsFeature &
    SolanaSignMessageFeature &
    SolanaSignTransactionFeature &
    SolanaSignAndSendTransactionFeature = {
    'standard:connect': {
      version: '1.0.0',
      connect: async (input) => {
        if (accountsOf(provider.session).length === 0) {
          if (input?.silent) {
            throw new Error('No WalletConnect session to restore')
          }
          await provider.connect({
            optionalNamespaces: {
              solana: {
                chains: [...SOLANA_WALLETCONNECT_CHAINS],
                methods: [...SOLANA_WALLETCONNECT_METHODS],
                events: [...SOLANA_WALLETCONNECT_EVENTS],
              },
            },
          })
        }
        const accounts = accountsOf(provider.session)
        if (accounts.length === 0) {
          // Say what the wallet did approve: a wallet that handles only EVM
          // over WalletConnect (MetaMask, at the time of writing) settles
          // with an eip155 namespace and no solana one.
          const approved = Object.keys(provider.session?.namespaces ?? {})
          throw new Error(
            approved.length > 0
              ? `${provider.session?.peer.metadata.name ?? 'The wallet'} approved ${approved.join(', ')} but no Solana account; it may not support Solana over WalletConnect`
              : 'The wallet approved no Solana account',
          )
        }
        return { accounts }
      },
    },
    'standard:disconnect': {
      version: '1.0.0',
      disconnect: () => provider.disconnect(),
    },
    'standard:events': {
      version: '1.0.0',
      on: (event, listener) => {
        if (event !== 'change') return () => {}
        watch()
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    'solana:signMessage': {
      version: '1.0.0',
      signMessage: async (...inputs) =>
        Promise.all(
          inputs.map(async ({ account, message }) => {
            const session = accountFor(account)
            const { signature } = (await provider.request(
              {
                method: 'solana_signMessage',
                params: {
                  message: base58.encode(message),
                  pubkey: account.address,
                },
              },
              caip2For(session),
            )) as { signature: string }
            return {
              signedMessage: message,
              signature: base58.decode(signature),
              signatureType: 'ed25519' as const,
            }
          }),
        ),
    },
    'solana:signTransaction': {
      version: '1.0.0',
      supportedTransactionVersions: ['legacy', 0],
      signTransaction: async (...inputs) =>
        Promise.all(
          inputs.map(async ({ account, transaction, chain }) => {
            const session = accountFor(account)
            const result = (await provider.request(
              {
                method: 'solana_signTransaction',
                params: { transaction: base64.encode(transaction) },
              },
              caip2For(session, chain),
            )) as { signature?: string; transaction?: string }
            // Newer wallets return the signed transaction; the spec's
            // baseline is the signature alone, which we splice in.
            if (result.transaction) {
              return { signedTransaction: base64.decode(result.transaction) }
            }
            if (!result.signature) {
              throw new Error(
                'Wallet returned neither a transaction nor a signature',
              )
            }
            return {
              signedTransaction: withSignature(
                transaction,
                session.publicKey as Uint8Array,
                base58.decode(result.signature),
              ),
            }
          }),
        ),
    },
    'solana:signAndSendTransaction': {
      version: '1.0.0',
      supportedTransactionVersions: ['legacy', 0],
      signAndSendTransaction: async (...inputs) =>
        Promise.all(
          inputs.map(async ({ account, transaction, chain, options }) => {
            const session = accountFor(account)
            const { signature } = (await provider.request(
              {
                method: 'solana_signAndSendTransaction',
                params: {
                  transaction: base64.encode(transaction),
                  ...(options && { sendOptions: options }),
                },
              },
              caip2For(session, chain),
            )) as { signature: string }
            return { signature: base58.decode(signature) }
          }),
        ),
    },
  }

  const wallet: SolanaStandardWallet = {
    version: '1.0.0',
    get name() {
      return provider.session?.peer.metadata.name ?? 'WalletConnect'
    },
    get icon() {
      return (provider.session?.peer.metadata.icons?.[0] ??
        walletConnectLogo) as WalletIcon
    },
    chains: [SOLANA_MAINNET_CHAIN, SOLANA_DEVNET_CHAIN],
    get accounts() {
      return accountsOf(provider.session)
    },
    features,
  }
  wallets.set(provider, wallet)
  providersByWallet.set(wallet, provider)
  return wallet
}
