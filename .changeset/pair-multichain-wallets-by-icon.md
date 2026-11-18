---
"@zerodev/wallet-react-ui": patch
---

A multichain wallet's two registrations, the EIP-6963 connector and the Wallet Standard wallet, are paired by name, by the wallet guide's `solanaName`, or by icon, no longer by the display name alone. Trust Wallet, which announces as "Trust Wallet" and registers as "Trust", now reads as one wallet. A wallet that spells its name differently on the two sides was listed as two wallets and, on Disconnect (EVM), was asked to revoke the site, which ended its Solana session too; with the icon as the second key it merges into one row and the EVM side is detached without a revoke. The saved Solana session keeps the icon so the restore guard uses the same key.
