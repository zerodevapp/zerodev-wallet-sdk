import type { Connector } from 'wagmi'
import type { WalletInfo } from '../auth/hooks/useWalletInfo.js'
import type { SolanaStandardWallet } from '../solana/types.js'

/**
 * The chain families the kit connects external wallets for: EVM through
 * wagmi, Solana through the kit's own slot. CAIP-2 namespace ids, as AppKit
 * uses them. The embedded wallet (passkey, Google, email) is meant to join
 * as its own namespace later, with `connect({ method, authenticator })`.
 */
export type KitNamespace = 'eip155' | 'solana'

export type KitAccountStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'

/** What a namespace connects: a wagmi connector announced through EIP-6963
 * for EVM, a Wallet Standard wallet for Solana. */
export type KitWallet<NS extends KitNamespace> = NS extends 'eip155'
  ? Connector
  : SolanaStandardWallet

/**
 * `connect` parameters, per namespace. Both external-wallet namespaces take
 * a wallet from the adapter's `wallets`. Omitted, the kit's sign-up flow
 * opens instead and the promise follows it: resolved once that namespace
 * connects, rejected with `AuthFlowDismissedError` when the user closes it.
 * The host must render `ConnectWallet` for that.
 */
export type KitConnectParams<NS extends KitNamespace> = {
  wallet?: KitWallet<NS>
}

/** A connect addressed to a namespace, for the combined view. */
export type KitConnectRequest =
  | ({ namespace: 'eip155' } & KitConnectParams<'eip155'>)
  | ({ namespace: 'solana' } & KitConnectParams<'solana'>)

export type KitDisconnectParams = {
  /** Disconnect one side and keep the other. Omitted, both go. */
  namespace?: KitNamespace
}

/** One namespace's connection, as the host reads it. */
export type KitAccount = {
  status: KitAccountStatus
  isConnected: boolean
  /** A silent restore after a reload is in flight: nothing is connected
   * yet, but nothing has been decided either. Hold any "signed out"
   * redirect while this is true. For Solana it covers the whole restore,
   * from the first render through loading the WalletConnect provider to
   * the silent connect, and clears on any outcome; with nothing saved it
   * clears after the first render. True on the server and the first client
   * render alike, like wagmi's `reconnecting` under `ssr: true`, so markup
   * driven by it hydrates cleanly. */
  isReconnecting: boolean
  /** Checksummed hex (EVM) or base58 (Solana); undefined while disconnected. */
  address: string | undefined
  /** Name, icon and source of the wallet behind the connection. */
  walletInfo: WalletInfo | undefined
}

/**
 * One namespace behind one interface: the same members for every namespace,
 * with the namespace's own implementation and parameter types behind them.
 */
export type KitAdapter<NS extends KitNamespace> = KitAccount & {
  namespace: NS
  /** Installed wallets the host can offer. Live; empty during server
   * rendering. */
  wallets: readonly KitWallet<NS>[]
  /** Whether a WalletConnect door is configured for this namespace
   * (`zeroDevWalletConnect` on the wagmi config; `solana: true` for the
   * Solana side). */
  walletConnect: boolean
  connect: (params?: KitConnectParams<NS>) => Promise<void>
  /** Disconnect this namespace and keep the other. For EVM, a wallet that
   * also serves the Solana slot is detached at wagmi's state level rather
   * than asked to revoke, which such wallets apply to the whole site. */
  disconnect: () => Promise<void>
}

/** Every namespace side by side, plus the cross-namespace actions. */
export type ZeroDevWalletKit = {
  eip155: KitAdapter<'eip155'>
  solana: KitAdapter<'solana'>
  /** Either namespace is connected. */
  isConnected: boolean
  /** Either namespace is restoring a session after a reload. */
  isReconnecting: boolean
  connect: (params: KitConnectRequest) => Promise<void>
  disconnect: (params?: KitDisconnectParams) => Promise<void>
}

export type ZeroDevWalletKitOptions = {
  /** Restore the Solana session after a reload, the way wagmi's
   * `reconnectOnMount` restores the EVM one. Default `true`; set `false`
   * in a host that does not offer Solana. */
  reconnectOnMount?: boolean
}
