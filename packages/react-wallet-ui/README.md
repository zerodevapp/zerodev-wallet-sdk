# @zerodev/react-wallet-ui

React wallet UI kit for ZeroDev — drop-in **authentication** and **transaction
signing** flows built on top of a standard [wagmi](https://wagmi.sh) setup, plus
an enhanced wagmi connector that drives them.

Mount two components, get a full embedded-wallet experience: a multi-step sign-in
screen (passkey / email / Google) and a confirmation UI that gates signing on
explicit user approval. UI styling comes from
[`@zerodev/react-ui`](../react-ui/README.md).

## Installation

```bash
pnpm add @zerodev/react-wallet-ui \
  @zerodev/wallet-core @zerodev/wallet-react \
  wagmi viem @wagmi/core @tanstack/react-query zustand
```

> `@zerodev/wallet-core`, `@zerodev/wallet-react`, `wagmi`, `viem`,
> `@wagmi/core`, `@tanstack/react-query`, and `zustand` are **peer
> dependencies** — install them alongside this package.

## Setup

### 1. Add the connector to your wagmi config

```tsx
import { zeroDevWallet } from '@zerodev/react-wallet-ui'
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
import '@zerodev/react-wallet-ui/styles.css'
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

Mount `<AuthFlow />` to render the active sign-in screen, and
`<SignatureRequest />` to gate signing on user confirmation. Connecting via the
`zeroDevWallet` connector is what opens the auth flow.

```tsx
import { AuthFlow, SignatureRequest } from '@zerodev/react-wallet-ui'
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

  return <SignatureRequest />
}
```

### Signing modes

The connector decides whether a request prompts the user. Configure it via
`config.signing`:

- `{ mode: 'prompt' }` (default) — listed methods raise a `<SignatureRequest />`
  confirmation. Override which methods with `{ mode: 'prompt', methods: [...] }`.
- `{ mode: 'background' }` — sign without prompting.

### Custom confirmation UI

Instead of rendering `<SignatureRequest />`, drive your own UI with the pending
request and its `confirm` / `reject` callbacks:

```tsx
import { usePendingRequest } from '@zerodev/react-wallet-ui'

function MyPrompt() {
  const { pendingRequest, confirm, reject } = usePendingRequest()
  if (!pendingRequest) return null
  return (
    <dialog open>
      <p>Confirm {pendingRequest.method}?</p>
      <button onClick={confirm}>Approve</button>
      <button onClick={reject}>Reject</button>
    </dialog>
  )
}
```

## API

| Export | Description |
| --- | --- |
| `zeroDevWallet` | wagmi connector with kit-specific auth + signing extensions. |
| `<AuthFlow />` | Renders the current auth step (sign-in, OTP, verifying, etc.). |
| `<SignatureRequest />` | Confirmation UI for pending signing requests. |
| `useAuth` | Read / drive the auth flow state. |
| `usePendingRequest` | The head pending request plus `confirm` / `reject` — for custom confirmation UI. |
| `usePendingRequests` | Read-only subscription to the full pending queue. Safe to call alongside `<SignatureRequest />`. |

### Types

`SignatureRequestProps`, `AuthMethod`, `AuthStep`, `SigningConfig`,
`ZeroDevKitConfig`, `ZeroDevKitConnectorParams`, `PendingRequest`, `Request`,
`RequestMethod`.

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
pnpm docs:dev    # local docs site (vocs)
```
