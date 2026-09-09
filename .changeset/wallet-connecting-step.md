---
'@zerodev/wallet-react-ui': patch
---

fix: external wallet connection no longer freezes the sign-up page

Picking an external wallet now moves to a `wallet-connecting` step instead of
disabling every sign-up button while wagmi's `connect()` is pending. A wallet
that is locked, or whose popup the user closed without answering, never
answers — the old design left the page frozen with no error and no way out.
The new step shows which wallet is being connected, lets the user cancel or
try again whatever the wallet does, explains a user rejection, and translates
MetaMask's `-32002` "request already pending" into what to do about it.

The connecting page owns the `connect()` call: React Query drops per-call
mutation callbacks when the component that issued them unmounts, and the
sign-up page unmounts on the step change.

If the user cancels and the wallet is approved later anyway, `ConnectWallet`
recognises the connection (keyed on the exact connector the user picked) and
closes, instead of leaving the widget open on sign-up.

Also fixes the back arrow that appeared on reopening the widget after
connect → disconnect: `goToStep(null)` now clears the step history, since a
`null` step means the flow is over and there is nothing to go back to.
