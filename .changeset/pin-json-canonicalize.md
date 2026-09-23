---
'@zerodev/wallet-core': patch
---

fix: pin `json-canonicalize` to exactly 2.0.0

`json-canonicalize@2.0.1` is a broken npm publish: its `main`/`module` point
at `bundles/` and `esm5/` build output that is missing from the tarball (only
`src/*.ts` ships). Our previous `^2.0.0` range resolved to 2.0.1 on every
fresh install, so new consumers of `@zerodev/wallet-core` crashed at runtime
with `Cannot find module 'json-canonicalize'`. The SDK repo's own lockfile
held 2.0.0, which is why this never reproduced locally.

Pinned to the exact known-good 2.0.0 until upstream ships a fixed release
(3.0.0 requires separate validation before adopting).
