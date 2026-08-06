---
'@zerodev/wallet-core': minor
---

Harden signer and session state transitions across authentication, refresh,
signing, logout, and crash recovery. This also preserves EIP-7702 `yParity`,
purges staged bearer tokens on logout, and adds an explicit
`logout({ force: true })` recovery path for irrecoverable remote teardown
failures.

Custom API-key stampers must now support pending-key preparation, pending
signing/stamping, explicit commit, and discard so the SDK can keep the active
key unchanged until the backend accepts its replacement.
