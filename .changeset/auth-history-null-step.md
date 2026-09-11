---
'@zerodev/wallet-react-ui': patch
---

fix: no stray back arrow after signing in with an external wallet and logging out

`goToStep(null)` now clears the step history. Ending the flow used to push the
current step onto the history, and an external wallet's disconnect never runs
the kit's `reset()`, so the next open of the widget showed a back arrow that
led nowhere.
