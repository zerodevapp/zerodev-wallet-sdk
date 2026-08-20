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
    }),
  ],
  transports: { [sepolia.id]: http() },
})
```

To let users pair mobile wallets over WalletConnect, also add the kit's
preconfigured connector (one WalletConnect connector per app — the kit drives
it, so don't run a separate WalletConnect UI of your own alongside it):

```tsx
import { zeroDevWallet, zeroDevWalletConnect } from '@zerodev/wallet-react-ui'

connectors: [
  zeroDevWallet({ ... }),
  zeroDevWalletConnect({ projectId: 'your-reown-project-id' }), // https://dashboard.reown.com
],
```

It wraps wagmi's `walletConnect` connector with `showQrModal: false` baked in
— required so WalletConnect's own modal never pops over the kit's UI — and
forwards any other WalletConnect parameters (e.g. `metadata`). The kit only
pairs through connectors created by this factory; a raw `walletConnect()`
connector in your config is ignored.

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

Mount `<ConnectWallet />` to render the active sign-in screen. Connecting via the
`zeroDevWallet` connector is what opens the auth flow.

```tsx
import { ConnectWallet } from '@zerodev/wallet-react-ui'
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
        <ConnectWallet />
      </>
    )
  }

  return <YourApp />
}
```

### Customizing the sign-up page

Bare `<ConnectWallet />` renders the canonical sign-up page (passkey → Google →
email). Which methods appear — and how — is decided by composition, not
config.

Keep the default page and set its options:

```tsx
<ConnectWallet
  logo={<YourLogo />}
  renderSignUp={() => (
    <SignUp.Default
      emailAuthMethod="otp" // 'magicLink' (default) | 'otp'
      termsAndConditionsUrl="https://example.com/terms"
      privacyPolicyUrl="https://example.com/privacy"
    />
  )}
/>
```

Or compose the page yourself from the `SignUp.*` units:

```tsx
import { ConnectWallet, SignUp } from '@zerodev/wallet-react-ui'

<ConnectWallet
  renderSignUp={() => (
    <SignUp emailAuthMethod="otp" termsAndConditionsUrl="https://example.com/terms">
      <SignUp.Google />
      <SignUp.Divider />
      <SignUp.Email />
    </SignUp>
  )}
/>
```

- `<SignUp>` (the root) owns the shared page state and the consent gate: when
  either terms URL is set, a checkbox appears and every method is blocked
  until the user agrees. `emailAuthMethod` picks the email verification flow.
- Units: `SignUp.Passkey`, `SignUp.Google`, `SignUp.Email`, `SignUp.Wallet`,
  `SignUp.WalletConnect`, `SignUp.InstalledWallets`, `SignUp.MoreWallets`,
  `SignUp.Divider`. Order and presence are yours; while one method is in
  flight, the others disable themselves.
- `SignUp.Wallet` pins one external wallet as its own row. `walletId` is the
  `WalletId` union (e.g. `'metamask'`, `'coinbase'`, `'rabby'`); the row
  connects the wallet when a live connector claims it (browser extension or a
  configured SDK connector) and is a link to the vendor's download page
  otherwise. With WalletConnect configured, the row instead opens the pairing
  sheet — phone pairing on one tab, the browser connect/download on the other.
- `SignUp.InstalledWallets` auto-discovers installed wallets: one row with an
  INSTALLED badge per announced (EIP-6963) browser extension, and nothing when
  none are installed. With WalletConnect configured, rows of known wallets
  open the pairing sheet; unknown extensions still connect directly. Wallets pinned via `SignUp.Wallet` are excluded
  automatically; `excludeWalletIds` hides further wallets by guide id or rdns,
  and `maxWallets` caps the list (default 4, known wallets ranked first).
- `SignUp.WalletConnect` renders a "WalletConnect" row that opens a pairing
  sheet: a QR code any mobile wallet can scan, plus a copy-link fallback. The
  pairing starts when the sheet opens and a fresh link is generated per open.
  The row renders nothing unless a `zeroDevWalletConnect` connector is in
  your wagmi config.
- `SignUp.MoreWallets` renders a row that opens an overlay sheet with the full
  wallet grid — every known wallet plus any other live connector; installed
  ones connect, the rest link to the vendor's download page. With
  WalletConnect configured, known wallets' tiles open the pairing sheet
  instead.
- `SignUp.Default` is the canonical composition; it accepts the same props as
  the root and forwards them.
- Auth success/failure surfaces through wagmi — await `connect`, or watch
  `useAccount()`.

## API

| Export | Description |
| --- | --- |
| `zeroDevWallet` | wagmi connector with kit-specific auth extensions. |
| `zeroDevWalletConnect` | WalletConnect connector preconfigured for the kit (`showQrModal: false`). |
| `<ConnectWallet />` | Renders the current auth step (sign-in, OTP, verifying, etc.). Props: `logo`, `renderSignUp`, `size`, `onClose`. |
| `<SignUp />` | Compound sign-up page: `SignUp.Default` plus the composable units (`Passkey`, `Google`, `Email`, `Wallet`, `WalletConnect`, `InstalledWallets`, `MoreWallets`, `Divider`). |
| `useAuth` | Read / drive the auth flow state. |

### Types

`AuthMethod`, `AuthStep`, `EmailAuthMethod`, `WalletId`,
`ZeroDevKitConnectorParams`.

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
```
