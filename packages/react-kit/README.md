# @zerodev/wallet-react-kit

React UI components and an enhanced wagmi connector for the
[ZeroDev Wallet SDK](https://zerodev.app). Drop-in flows for
authentication and transaction signing on top of a standard wagmi setup.

## Installation

```bash
pnpm add @zerodev/wallet-react-kit wagmi viem @tanstack/react-query
```

## Setup

1. **Add the connector to your wagmi config:**

   ```tsx
   import { zeroDevWallet } from '@zerodev/wallet-react-kit'
   import { createConfig, http } from 'wagmi'
   import { sepolia } from 'wagmi/chains'

   export const config = createConfig({
     chains: [sepolia],
     connectors: [
       zeroDevWallet({
         projectId: 'your-project-id',
         chains: [sepolia],
         config: {
           auth: {
             magicLinkBaseUrl: 'https://yourdomain.com/auth/verify',
             enabledMethods: ['email', 'google', 'passkey'],
           },
         },
       }),
     ],
     transports: { [sepolia.id]: http() },
   })
   ```

2. **Import the stylesheet once at app entry:**

   ```tsx
   import '@zerodev/wallet-react-kit/styles.css'
   ```

3. **Wrap your app in `WagmiProvider` + `QueryClientProvider`** (standard
   wagmi setup).

## Usage

Mount `<AuthFlow />` to render the active sign-in screen, and
`<SignatureRequest />` to gate signing on user confirmation:

```tsx
import { AuthFlow, SignatureRequest } from '@zerodev/wallet-react-kit'
import { useConnect } from 'wagmi'

function App() {
  const { connect, connectors } = useConnect()

  return (
    <>
      <button onClick={() => connect({ connector: connectors[0] })}>
        Connect
      </button>
      <AuthFlow />
      <SignatureRequest />
    </>
  )
}
```

## API

| Export | Description |
| --- | --- |
| `zeroDevWallet` | wagmi connector with kit-specific extensions. |
| `<AuthFlow />` | Renders the current auth step (sign-in, OTP, etc.). |
| `<SignatureRequest />` | Confirmation UI for signing requests. |
| `useAuth` | Read / drive the auth flow state. |
| `usePendingRequest` | Register a custom confirmation UI (head request + `confirm` / `reject`). |
| `usePendingRequests` | Read-only subscription to the pending queue. Safe to call alongside `<SignatureRequest />`. |

See the [full documentation](https://docs.zerodev.app/wallets/react-kit/getting-started)
for configuration options, hooks, and feature guides.

## Development

```bash
pnpm build       # build the package
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test
pnpm storybook
pnpm docs:dev    # local docs site
```
