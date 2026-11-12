---
"@zerodev/wallet-react-ui": minor
---

feat: external Solana wallet login beside the EVM side. Installed Wallet Standard wallets (`SignUp.InstalledWallets` and `SignUp.Wallet` with a `solana` namespace; a wallet installed for both chains asks which to connect) and a WalletConnect `solana` session (`zeroDevWalletConnect({ solana: true })`, `SignUp.SolanaWalletConnect`) connect into the kit's own Solana slot; `useSolanaWallet` relays signing to the wallet. `useZeroDevWalletKit` reads and drives both namespaces through one adapter interface, with `connect` / `disconnect` that know the cross-namespace rules, `isReconnecting` for the restore window, and `AuthFlowDismissedError` as a cancellation. `useWalletInfo('solana')` names the Solana wallet.
