---
"@zerodev/wallet-react": patch
"@zerodev/wallet-core": patch
---

Fix concurrent session refreshes across browser tabs. Every open tab refreshed at the same instant and sent its own stamp login, which Turnkey fails for one sub-org. Refresh now takes a cross-tab Web Lock and adopts a session another tab already refreshed. Writes of the shared key vault and session are serialized across tabs, while passkey prompts and OAuth popups stay outside the lock. The React provider clears local state if another tab signed in to a different account.
