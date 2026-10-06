import type { SolanaChain } from '@solana/wallet-standard-chains'
import type {
  SolanaSignAndSendTransactionFeature,
  SolanaSignAndSendTransactionOptions,
  SolanaSignMessageFeature,
  SolanaSignTransactionFeature,
} from '@solana/wallet-standard-features'
import { useMemo } from 'react'
import { useStore } from 'zustand'
import { useKitStore } from '../../shared/hooks/useKitStore'
import type { SolanaConnection } from '../types'

export type SolanaWalletHandle = Pick<
  SolanaConnection,
  'wallet' | 'account'
> & {
  /** Sign raw message bytes with the connected account; the wallet prompts.
   * `null` when the wallet lacks `solana:signMessage`. */
  signMessage:
    | ((message: Uint8Array) => Promise<{
        signature: Uint8Array
        /** The bytes the wallet actually signed (some wallets prefix). */
        signedMessage: Uint8Array
      }>)
    | null
  /** Sign a serialized transaction and return the signed bytes. Defaults to
   * the account's first chain. `null` without `solana:signTransaction`. */
  signTransaction:
    | ((transaction: Uint8Array, chain?: SolanaChain) => Promise<Uint8Array>)
    | null
  /** Sign and broadcast; resolves to the transaction signature bytes.
   * `null` without `solana:signAndSendTransaction`. */
  signAndSendTransaction:
    | ((
        transaction: Uint8Array,
        chain?: SolanaChain,
        options?: SolanaSignAndSendTransactionOptions,
      ) => Promise<Uint8Array>)
    | null
}

function buildHandle(connection: SolanaConnection): SolanaWalletHandle {
  const { wallet, account } = connection
  const features = wallet.features as Partial<
    SolanaSignMessageFeature &
      SolanaSignTransactionFeature &
      SolanaSignAndSendTransactionFeature
  >
  const defaultChain = connection.chains[0]

  // Capabilities are declared per wallet and per account: a wallet can
  // expose a feature that the selected account (a hardware or watch-only
  // account, say) cannot use. Offer a method only when both agree.
  const forAccount = <K extends keyof typeof features>(name: K) =>
    account.features.includes(name) ? features[name] : undefined
  const signMessageFeature = forAccount('solana:signMessage')
  const signTransactionFeature = forAccount('solana:signTransaction')
  const signAndSendFeature = forAccount('solana:signAndSendTransaction')

  return {
    wallet,
    account,
    signMessage: signMessageFeature
      ? async (message) => {
          const [result] = await signMessageFeature.signMessage({
            account,
            message,
          })
          if (!result) throw new Error('Wallet returned no signature')
          return {
            signature: new Uint8Array(result.signature),
            signedMessage: new Uint8Array(result.signedMessage),
          }
        }
      : null,
    signTransaction: signTransactionFeature
      ? async (transaction, chain = defaultChain) => {
          const [result] = await signTransactionFeature.signTransaction({
            account,
            transaction,
            ...(chain && { chain }),
          })
          if (!result) throw new Error('Wallet returned no transaction')
          return new Uint8Array(result.signedTransaction)
        }
      : null,
    signAndSendTransaction: signAndSendFeature
      ? async (transaction, chain = defaultChain, options) => {
          if (!chain) {
            throw new Error('A Solana chain is required to send a transaction')
          }
          const [result] = await signAndSendFeature.signAndSendTransaction({
            account,
            transaction,
            chain,
            ...(options && { options }),
          })
          if (!result) throw new Error('Wallet returned no signature')
          return new Uint8Array(result.signature)
        }
      : null,
  }
}

/**
 * The connected Solana wallet, for the host to sign with. The kit never
 * signs: `signMessage`, `signTransaction` and `signAndSendTransaction` call
 * the wallet's own Wallet Standard features, so the wallet (Phantom,
 * MetaMask, …) shows its prompt and returns the signature. Each is `null`
 * when the wallet, or the connected account, does not expose that feature;
 * the raw `wallet` and
 * `account` are there for anything else (for example a `@solana/kit`
 * signer). `null` while disconnected.
 */
export function useSolanaWallet(): SolanaWalletHandle | null {
  const store = useKitStore()
  const connection = useStore(store, (s) => s.solana.connection)
  return useMemo(
    () => (connection ? buildHandle(connection) : null),
    [connection],
  )
}
