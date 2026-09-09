# `@zerodev/wallet-data`

Signed ZeroDev Data API queries and TanStack Query hooks. Install this package
only when an application uses Data API features; `wallet-core` and
`wallet-react` do not import it.

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

The Data API origin is required while this feature is in private preview. A URL
embedded in a browser or React Native application is observable and should be
treated as feature configuration, not as a secret.
