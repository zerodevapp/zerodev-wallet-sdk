# @zerodev/wallet-react-ui

React wallet UI kit for ZeroDev — a drop-in **authentication** flow built on top
of a standard [wagmi](https://wagmi.sh) setup, plus an enhanced wagmi connector
that drives it.

Mount one component, get a full embedded-wallet sign-in experience: a multi-step
screen for passkey / email / Google. UI styling comes from
[`@zerodev/react-ui`](../react-ui/README.md).

## Installation

```bash
pnpm add @zerodev/wallet-react-ui \
  @zerodev/wallet-core @zerodev/wallet-react \
  wagmi viem @wagmi/core @tanstack/react-query zustand
```

> `@zerodev/wallet-core`, `@zerodev/wallet-react`, `wagmi`, `viem`,
> `@wagmi/core`, `@tanstack/react-query`, and `zustand` are **peer
> dependencies** — install them alongside this package.

## Setup

### 1. Add the connector to your wagmi config

```tsx
import { zeroDevWallet } from '@zerodev/wallet-react-ui'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevWallet({
      projectId: 'your-project-id', // from https://dashboard.zerodev.app
      chains: [sepolia],
      config: {
        auth: {
          enabledMethods: ['email', 'google', 'passkey'],
        },
      },
    }),
  ],
  transports: { [sepolia.id]: http() },
})
```

### 2. Import the stylesheet once at app entry

```tsx
import '@zerodev/wallet-react-ui/styles.css'
```

### 3. Wrap your app in the wagmi + React Query providers

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi-config'

const queryClient = new QueryClient()

function Root() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

## Usage

Mount `<AuthFlow />` to render the active sign-in screen. Connecting via the
`zeroDevWallet` connector is what opens the auth flow.

```tsx
import { AuthFlow } from '@zerodev/wallet-react-ui'
import { useAccount, useConnect } from 'wagmi'

function App() {
  const { status } = useAccount()
  const { connect, connectors } = useConnect()

  if (status !== 'connected') {
    return (
      <>
        <button onClick={() => connect({ connector: connectors[0] })}>
          Connect
        </button>
        <AuthFlow />
      </>
    )
  }

  return <YourApp />
}
```

## API

| Export | Description |
| --- | --- |
| `zeroDevWallet` | wagmi connector with kit-specific auth extensions. |
| `<AuthFlow />` | Renders the current auth step (sign-in, OTP, verifying, etc.). |
| `useAuth` | Read / drive the auth flow state. |

### Types

`AuthMethod`, `AuthStep`, `ZeroDevKitConfig`, `ZeroDevKitConnectorParams`.

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
```
