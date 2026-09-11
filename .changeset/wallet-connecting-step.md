---
'@zerodev/wallet-react-ui': patch
---

fix: picking an external wallet no longer freezes the sign-up page

A wallet that is locked, or whose popup the user closed without answering,
never replies to `connect()`. The sign-up page disabled every button while that
request was pending, so it sat frozen with no message and no way out.

Picking an external wallet now moves to a `wallet-connecting` step that names
the wallet it is waiting on and always offers a way back to the other sign-in
methods. The connecting page owns the `connect()` call, so a wallet approved
after the user leaves the screen still closes the widget.
