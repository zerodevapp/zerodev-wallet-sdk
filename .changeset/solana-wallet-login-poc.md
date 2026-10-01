---
"@zerodev/wallet-react-ui": minor
---

Add external Solana wallet login (proof of concept). `SignUp.SolanaWallets` lists installed Solana wallets discovered through the Wallet Standard registry (Phantom, Solflare, Backpack, …) and connects one into a new `solana` slot in the kit store, independent of the wagmi (EVM) connection. New hooks: `useSolanaAccount`, `useSolanaWallet`, `useSolanaWallets`, `useSolanaAutoReconnect`; `useWalletInfo('solana')` reads the Solana slot. The kit signs nothing: hosts sign through the connected wallet's own `solana:*` features.
