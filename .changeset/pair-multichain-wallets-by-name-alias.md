---
"@zerodev/wallet-react-ui": patch
---

A multichain wallet's two registrations, the EIP-6963 connector and the Wallet Standard wallet, are paired by name or by the wallet guide's `solanaName`, the name a wallet registers under on Solana when it differs from its EIP-6963 one. Trust Wallet, which announces as "Trust Wallet" and registers as "Trust", was listed as two wallets and, on Disconnect (EVM), was asked to revoke the site, which ended its Solana session too; it now reads as one row and its EVM side is detached without a revoke. Only an EIP-6963 connector pairs with a Solana wallet: a WalletConnect or SDK session named like one keeps its own disconnect.
