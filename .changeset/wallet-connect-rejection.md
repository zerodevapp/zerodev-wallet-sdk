---
'@zerodev/wallet-react-ui': patch
---

fix: declining an external wallet connection now says so

Rejecting the request in the wallet returned the user to the sign-in options
with no explanation. The connecting page now shows "Request declined" with the
wallet's name, and offers Try again alongside the other sign-in methods.

A rejection is also recognised in every shape wallets throw it: an `Error`
carrying EIP-1193 `code: 4001` with a generic name, the raw JSON-RPC object
wagmi's injected connector rethrows, or either nested under `cause`. Only
viem's named error was matched before, so a rejection from those wallets was
reported as a failure.
