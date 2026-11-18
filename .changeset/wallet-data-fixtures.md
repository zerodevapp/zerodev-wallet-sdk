---
'@zerodev/wallet-data': minor
---

Exports the Data API contract fixtures from `@zerodev/wallet-data/fixtures`
for tests and stories: one transaction history item per shape the API
produces, keyed by a stable id. Also re-exports the
`TransactionHistoryCollection` type. The subpath also re-exports `KERNEL_ACCOUNT_FIXTURE`, the owner EOA and Kernel address the Data API derives with the connector's Kernel config.
