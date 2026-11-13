---
'@zerodev/wallet-data': minor
'@zerodev/wallet-react-ui': patch
---

Transaction history treats a 429 whose body reports `reason: 'quota_exhausted'` as final: no retry, and no refetch on mount, focus or reconnect until the query is reset. `isQuotaExhaustedError` is exported so hosts can tell it apart from a transient throttle; the history widget shows a "monthly limit reached" message without a retry button. A 429 or 503 is retried once only when Retry-After is at most 30 s away; a longer wait is no longer shortened to 30 s. `useTransactionHistory` defaults `staleTime` to 30 s, so mounting, refocusing and reconnecting no longer refetch every loaded page.
