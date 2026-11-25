---
"@zerodev/wallet-core": patch
---

Add server wallets through a new `@zerodev/wallet-core/server` entry. `createZeroDevServerWallet` lets a backend that holds an agent key create wallets and addresses, list them, and sign through a viem account that works as a Kernel signer in 4337 and 7702 mode. `toViemAccount` takes an `address` and an optional `getToken`, and `token` is optional on the sign actions.
