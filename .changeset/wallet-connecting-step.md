---
'@zerodev/wallet-react-ui': patch
---

fix: external wallet connection no longer freezes the sign-up page

Picking an external wallet now moves to a `wallet-connecting` step instead of
disabling every sign-up button while wagmi's `connect()` is pending. A wallet
that is locked, or whose popup the user closed without answering, never
answers — the old design left the page frozen with no error and no way out.
The new step shows which wallet it is waiting on and always offers a way
back to the other sign-in methods, whatever the wallet does.

Outcomes are reported for what they are: a user rejection reads "Request
declined"; MetaMask's `-32002` "request already pending" (popup closed, then
clicked again) is rendered as a waiting state — "Request waiting in MetaMask",
with the instruction to finish it from the extension — since nothing failed
and the wallet will not show a second prompt until the first is answered.
Wallets throw that error as a raw JSON-RPC object, not an `Error`; it no
longer renders as `[object Object]`.

The connecting page owns the `connect()` call and watches wagmi's store
directly for the connection: hosts typically redirect the moment
`isConnected` flips and unmount the widget in that same render, which drops
React-side callbacks. Without a signal that survives unmount the flow was left
at `wallet-connecting`, and the next time the widget mounted (e.g. after
logout) it re-prompted the wallet. A late approval after the user has left
the screen still closes the widget for the same reason.

Also fixes the back arrow that appeared on reopening the widget after
connect → disconnect: `goToStep(null)` now clears the step history, since a
`null` step means the flow is over and there is nothing to go back to.

A wallet whose persisted connection wagmi already restored closes the flow
immediately instead of failing with `ConnectorAlreadyConnectedError`.

Re-picking a wallet whose request is still unanswered re-adopts the open
attempt instead of sending another `connect()`: wallets queue connection
requests, approving one leaves the rest queued, and the leftovers resurface
later as ghost prompts (e.g. right after logout).

New export `useDisconnect`: a drop-in replacement for wagmi's that never
surfaces a wallet prompt. wagmi's injected connector sends
`wallet_revokePermissions` on disconnect; if the wallet still holds an
unanswered connection request for the origin (ignored prompt + reload —
pending confirmations live in the extension and survive reloads), the revoke
re-arms it and the wallet pops its connect view at logout. EIP-1193 offers no
way to clear a wallet's queue, so this hook suppresses the revoke: disconnect
stays app-side (wagmi state + reconnect shim), and the site remains
authorized in the wallet until the user revokes it there.
