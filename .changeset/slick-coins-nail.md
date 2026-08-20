---
"@zerodev/wallet-core": patch
---

getUserWallet now reads the wallet from the /wallets endpoint. On an expired session it rejects with a 401 RestRequestError (a clear re-authenticate signal) instead of resolving a placeholder/malformed address from the deprecated /user-wallet route. No change to the function signature or return type.
