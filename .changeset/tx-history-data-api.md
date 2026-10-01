---
'@zerodev/wallet-react-ui': minor
---

`<TxHistory />` now shows the connected ZeroDev wallet's real transaction
history from the Data API, with a details page for each transaction. The
`History` list view, the `TransactionDetails` view, `toTxHistoryEntry`, and the
`HistoryFeed` type are exported for custom layouts.

**Breaking:** `TxHistory` no longer accepts `entries` or `onSelectEntry`. It
requires a `dataApi` prop (`{ baseUrl, environment?, chainIds? }`) and owns the
fetch and the details step. The `TxHistoryStep` type is removed.
`TxHistoryEntry` replaces `chainName` and `chainIconUrl` with
`chain: { name, iconUri? }`, renames `timestamp` to `timestampMs`, drops `destChainName` and `destChainIconUrl`, and
makes `value` optional. `@zerodev/wallet-data` and `zod` are new peer
dependencies.
