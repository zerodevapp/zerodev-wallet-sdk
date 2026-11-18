---
'@zerodev/wallet-data': minor
---

`useTransactionHistory` returns `refresh()` and `waitForTransaction(txHash)`. `refresh()` refetches every loaded page and asks the Data API to skip its cache for page 1, which spends one lookup from the monthly budget. `waitForTransaction` resolves `true` once the hash is in a loaded page, polling at most 6 times over about 51 s, and resolves `false` on timeout, unmount, or a spent monthly budget. Mount, focus and `staleTime` refetches still use the server cache. `getTransactionHistory` accepts `fresh` on a first page; `fresh` with `next` does not typecheck. Requires a Data API that supports `fresh`.
