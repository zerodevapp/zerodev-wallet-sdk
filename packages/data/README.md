# `@zerodev/wallet-data`

Signed ZeroDev Data API queries and TanStack Query hooks. Install this package
only when an application uses Data API features; `wallet-core` and
`wallet-react` do not import it. It runs the shared contract's schemas at
runtime, so `zod` (`^4.1.0`) is a peer dependency alongside `wagmi`,
`@tanstack/react-query`, and the ZeroDev wallet packages.

## Transaction history

```ts
import { useTransactionHistory } from '@zerodev/wallet-data'

const history = useTransactionHistory({
  baseUrl: process.env.NEXT_PUBLIC_ZERODEV_DATA_API_URL!,
  environment: 'mainnet',
})

const items = history.data?.pages.flatMap((page) => page.items) ?? []
```

The same query is available outside React hooks when a Wagmi config is already
available:

```ts
import { getTransactionHistory } from '@zerodev/wallet-data'

const firstPage = await getTransactionHistory(config, {
  baseUrl: process.env.ZERODEV_DATA_API_URL!,
  environment: 'mainnet',
})
```

`useTransactionHistory` reads the active ZeroDev connector's dapp-facing
account, stamps every page request with its current P-256 session key, and uses
the opaque `next` cursor for `fetchNextPage`.

### Filtering by chain

Pass `chainIds` to restrict the feed to specific chains. The filter is part of
the feed identity, so changing it starts a new query rather than appending to
the current one.

```ts
import { useTransactionHistory } from '@zerodev/wallet-data'

const history = useTransactionHistory({
  baseUrl: process.env.NEXT_PUBLIC_ZERODEV_DATA_API_URL!,
  chainIds: ['ethereum', 'arbitrum'],
})
```

`DATA_API_CHAIN_IDS` lists every accepted value; chains that belong to the other
environment are rejected with a 400. An empty `chainIds` array is a programmer
error: it throws a `TypeError` before anything is signed or sent. Omit the
parameter to query every chain. The client sends `chainIds` on every page, but
the server ignores it whenever `next` is present and follows the cursor instead.

The Data API origin is required while this feature is in private preview. A URL
embedded in a browser or React Native application is observable and should be
treated as feature configuration, not as a secret.
