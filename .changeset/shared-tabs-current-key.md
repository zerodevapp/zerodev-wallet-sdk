---
"@zerodev/wallet-react": patch
"@zerodev/wallet-core": patch
---

fix: tabs sharing a session always use its current key

- A tab's stamper keeps the key it loaded, while each request reads the token
  from storage, so after another tab refreshed, a tab signed the new token with
  the old key. Account requests now read the token and reload the shared key
  under a shared hold of the cross-tab lock, and refuse once another tab signed
  in to a different owner. A reloaded key that isn't the stored session's (a
  third tab mid-commit, possible without Web Locks) fails the request instead
  of stamping with it.
- This covers `toAccount()`. The raw `client` still stamps with the key the
  instance loaded and the token its caller passes.
- `logout()` holds the lock for its whole run and revokes the key stored at that
  moment, so a stale tab no longer fails to find it. An unscoped logout from any
  tab therefore ends the shared session. New `account` and `sessionId` options
  limit it to one owner or one session and otherwise change nothing.
- The React connector's `disconnect()` logs out only its own account, so a stale
  tab no longer ends a session another tab signed in to for someone else.
- `refreshSession()` reloads the key before stamping its login, and still adopts
  another tab's session after a request already reloaded that key.
- The React provider adopts a newer same-account session before dropping an
  expired or rejected one, and its 401 cleanup clears only the rejected session.
- `withCrossTabLock` is exported for wallet-react (`@internal`) and takes a lock
  `mode`. It is not re-entrant.
- Cross-tab latency: requests hold the shared lock for their round trip and
  logout holds it exclusively across its two, so another tab's refresh or start
  can wait behind them, up to the transport timeout on a failing network.
