---
'@zerodev/wallet-data': minor
---

Transaction history no longer retries a 429 whose body reports `reason: 'quota_exhausted'`, and it caps a server-provided Retry-After delay at 30 s. `useTransactionHistory` defaults `staleTime` to 30 s, so mounting, refocusing and reconnecting no longer refetch every loaded page.
