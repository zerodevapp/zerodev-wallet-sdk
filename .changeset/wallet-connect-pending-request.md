---
'@zerodev/wallet-react-ui': patch
---

fix: say when the wallet is still holding an earlier connection request

Closing a wallet popup without answering leaves the request open in the
extension. The wallet answers the next attempt with EIP-1193 `-32002` instead
of prompting again, which the connecting page reported as a failure — often as
raw JSON-RPC text, or `[object Object]` when the wallet threw a bare object.

That case now reads "Request waiting in {wallet}", rendered as a waiting state
rather than an error, and tells the user to approve or dismiss the request from
the wallet's toolbar icon before trying again.

Any error object without a usable message now falls back to a plain sentence
with its numeric code, so `[object Object]` can no longer reach the screen.
