---
'@zerodev/wallet-data': patch
---

`DATA_API_CHAIN_IDS` now lists 45 chains, every EVM chain both ZeroDev and the Data API's upstream serve, up from 3. `DataApiChainId` widens with it. A transaction-history request without `chainIds` spans every chain of its environment. Code that builds an exhaustive `Record<DataApiChainId, ...>` must add the new keys.
