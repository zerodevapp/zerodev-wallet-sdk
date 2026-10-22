import type { Connector } from 'wagmi'
import type { WalletInfo } from '../auth/hooks/useWalletInfo.js'
import type { SolanaStandardWallet } from '../solana/types.js'

/** The chain families the kit connects: EVM through wagmi, Solana through
 * the kit's own slot. CAIP-2 namespace ids, as AppKit uses them. */
export type KitNamespace = 'eip155' | 'solana'

export type KitAccountStatus =
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'connected'

/** One namespace's connection, as the host reads it. */
export type KitAccount = {
  namespace: KitNamespace
  status: KitAccountStatus
  isConnected: boolean
  /** A silent restore after a reload is in flight: nothing is connected
   * yet, but nothing has been decided either. Hold any "signed out"
   * redirect while this is true. For Solana it covers the whole restore,
   * from the saved-session check through loading the WalletConnect
   * provider to the silent connect, and clears on any outcome. Read from
   * the saved session, so it is false on the server and may be true on the
   * client's first render, like wagmi's `reconnecting`. */
  isReconnecting: boolean
  /** Checksummed hex (EVM) or base58 (Solana); undefined while disconnected. */
  address: string | undefined
  /** Name, icon and source of the wallet behind the connection. */
  walletInfo: WalletInfo | undefined
}

export type KitConnectParams =
  | {
      namespace?: 'eip155'
      /** An installed EVM wallet from `wallets.eip155`. Omitted, the kit's
       * sign-up flow opens (passkey, Google, email, installed wallets, …)
       * and the promise follows it: resolved once an EVM wallet is
       * connected, rejected with `AuthFlowDismissedError` when the user
       * closes it. The host must render `ConnectWallet` for that. */
      wallet?: Connector
    }
  | {
      namespace: 'solana'
      /** A Solana wallet from `wallets.solana`, prompted directly. Omitted,
       * the sign-up flow opens with whatever Solana units the host
       * composed (`SignUp.InstalledWallets` with a `solana` namespace,
       * `SignUp.SolanaWalletConnect`), and the promise follows it the same
       * way as for EVM. */
      wallet?: SolanaStandardWallet
    }

export type KitDisconnectParams = {
  /** Disconnect one side and keep the other. Omitted, both go. */
  namespace?: KitNamespace
}

export type ZeroDevWalletKit = {
  eip155: KitAccount
  solana: KitAccount
  /** Either namespace is connected. */
  isConnected: boolean
  /** Either namespace is restoring a session after a reload. */
  isReconnecting: boolean
  /** Installed wallets the host can offer, per namespace: EVM wallets
   * announced through EIP-6963 (as wagmi connectors), Solana wallets from
   * the Wallet Standard registry. Live; empty during server rendering. */
  wallets: {
    eip155: readonly Connector[]
    solana: readonly SolanaStandardWallet[]
  }
  /** Whether a WalletConnect door is configured per namespace
   * (`zeroDevWalletConnect` on the wagmi config, with `solana: true` for
   * the Solana side). */
  walletConnect: { eip155: boolean; solana: boolean }
  connect: (params?: KitConnectParams) => Promise<void>
  disconnect: (params?: KitDisconnectParams) => Promise<void>
}

export type ZeroDevWalletKitOptions = {
  /** Restore the Solana session after a reload, the way wagmi's
   * `reconnectOnMount` restores the EVM one. Default `true`; set `false`
   * in a host that does not offer Solana. */
  reconnectOnMount?: boolean
}
