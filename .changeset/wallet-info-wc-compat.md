---
'@zerodev/wallet-react': patch
'@zerodev/wallet-react-ui': patch
---

feat: `useWalletInfo` + WalletConnect compat fixes

- New `useWalletInfo` hook: identity of the wallet behind the active wagmi
  connection. Call-compatible with AppKit's `useWalletInfo` (same name, same
  `{ walletInfo }` return shape, optional ignored namespace arg), so
  migrating from AppKit is an import swap. `walletInfo` carries
  `{ name, icon, walletId, source }`, or is `undefined` while disconnected.
  Injected wallets resolve from the
  connector, WalletConnect connections from the session's peer metadata
  (the actual wallet on the other end, resolved asynchronously), the
  embedded wallet reports `source: 'embedded'`.
- `zustand` moved from peerDependencies to dependencies in both packages.
  The kit's store never crosses into host code, so there is no singleton to
  share — as a peer it only produced unmet-peer warnings for hosts on
  zustand 4.
- Test mocks for wagmi's `useConnect` now match its real return shape
  (`connect`, not `mutate`), keeping the suite valid on wagmi v2 and v3.
