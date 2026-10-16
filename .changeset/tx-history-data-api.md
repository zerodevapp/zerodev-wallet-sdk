---
'@zerodev/wallet-react-ui': minor
---

`<TxHistory />` now shows the connected ZeroDev wallet's real transaction
history from the Data API, with a details page for each transaction. The
`History` list view, the `TransactionDetails` view, `toTxHistoryEntry`, and the
`HistoryFeed` type are exported for custom layouts. A ready `HistoryFeed` can
carry `loadMoreError`, so the list stays rendered when loading the next page
fails.

**Breaking:** `TxHistory` no longer accepts `entries` or `onSelectEntry`. It
requires a `dataApi` prop (`{ baseUrl, environment?, chainIds? }`) and owns the
fetch and the details step. The `TxHistoryStep` type is removed.
`TxHistoryEntry` replaces `chainName` and `chainIconUrl` with
`chain: { name, iconUri? }`, renames `timestamp` to `timestampMs`, drops `destChainName` and `destChainIconUrl`, and
makes `value` optional. `@zerodev/wallet-data` and `zod` are new peer
dependencies.

Rows and the details hero describe what came in when a transaction has two
sides (a swap, or a mint paid in a token), so a paid mint headlines the NFT and
the details page shows a card for each side. An approval shows its allowance,
"Unlimited" for the max uint, and a revoke shows the bare unit. A collection
approval shows the collection name. An NFT held in quantity carries a count.
