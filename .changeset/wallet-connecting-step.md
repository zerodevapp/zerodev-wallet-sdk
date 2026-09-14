---
'@zerodev/wallet-react-ui': patch
---

fix: picking an external wallet no longer freezes the sign-up page

A wallet that is locked, or whose popup the user closed without answering,
never replies to `connect()`. The sign-up page disabled every button while that
request was pending, so it sat frozen with no message and no way out.

Picking an external wallet now moves to a `wallet-connecting` step that names
the wallet it is waiting on and always offers a way back to the other sign-in
methods. The page owns the `connect()` call, so a wallet approved after the
user leaves still closes the widget, and re-picking a wallet whose request is
still open re-adopts it rather than sending one the wallet would reject. A
failure that is not a user rejection is reported on the page instead of the
sign-up screen that used to show it.
