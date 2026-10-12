import {
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
  namespaces: Record<string, { accounts: string[]; methods?: string[] }>
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

/** Wallet Standard feature per `solana_*` method. The settled namespace
 * names the methods the wallet approved; the account advertises only those,
 * so the signing handle exposes `null` for the rest instead of a request
 * the SDK would refuse. */
const FEATURE_BY_METHOD: Record<string, IdentifierString> = {
  solana_signMessage: 'solana:signMessage',
  solana_signTransaction: 'solana:signTransaction',
  solana_signAndSendTransaction: 'solana:signAndSendTransaction',
}

type SessionAccount = WalletAccount & {
  /** The CAIP-2 ids the wallet approved this account on. Requests must name
   * the id the wallet knows, deprecated or not. */
  readonly caip2s: readonly string[]
}

function accountsOf(session: SolanaWcSession | undefined): SessionAccount[] {
  const byAddress = new Map<string, string[]>()
  for (const entry of session?.namespaces.solana?.accounts ?? []) {
    const parsed = parseSessionAccount(entry)
    if (!parsed || !caip2ToSolanaChain(parsed.caip2)) continue
    byAddress.set(parsed.address, [
      ...(byAddress.get(parsed.address) ?? []),
      parsed.caip2,
    ])
  }
  // The spec requires a method list; a wallet that omits it is taken to have
  // approved what was proposed.
  const methods =
    session?.namespaces.solana?.methods ?? SOLANA_WALLETCONNECT_METHODS
  const features = Object.entries(FEATURE_BY_METHOD)
    .filter(([method]) => methods.includes(method))
    .map(([, feature]) => feature)
  return [...byAddress.entries()].map(([address, caip2s]) => ({
    address,
    publicKey: base58.decode(address),
    chains: [
      ...new Set(caip2s.map((c) => caip2ToSolanaChain(c) as SolanaChain)),
    ],
    features,
    caip2s,
  }))
}

const wallets = new WeakMap<SolanaWcProvider, SolanaStandardWallet>()
const providersByWallet = new WeakMap<object, SolanaWcProvider>()

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

  /** One `solana_*` request for `account`, on the approved id of `chain`
   * (the account's first chain when none is given). */
  const relay = <T>(
    account: WalletAccount,
    chain: IdentifierString | undefined,
    method: string,
    params: Record<string, unknown>,
  ): Promise<T> => {
    const session = accountsOf(provider.session).find(
      (a) => a.address === account.address,
    )
    if (!session) throw new Error('This account is not in the session')
    const target = chain ?? session.chains[0]
    const caip2 = session.caip2s.find((c) => caip2ToSolanaChain(c) === target)
    if (!caip2) throw new Error(`The session does not include ${target}`)
    return provider.request({ method, params }, caip2) as Promise<T>
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
            const { signature } = await relay<{ signature: string }>(
              account,
              undefined,
              'solana_signMessage',
              { message: base58.encode(message), pubkey: account.address },
            )
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
            const result = await relay<{
              signature?: string
              transaction?: string
            }>(account, chain, 'solana_signTransaction', {
              transaction: base64.encode(transaction),
            })
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
                base58.decode(account.address),
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
            const { signature } = await relay<{ signature: string }>(
              account,
              chain,
              'solana_signAndSendTransaction',
              {
                transaction: base64.encode(transaction),
                ...(options && { sendOptions: options }),
              },
            )
            return { signature: base58.decode(signature) }
          }),
        ),
    },
  }

  const wallet: SolanaStandardWallet = {
    version: '1.0.0',
    source: 'walletconnect',
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
