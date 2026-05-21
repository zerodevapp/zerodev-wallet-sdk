# ZeroDev Wallet SDK

[![CI](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml)

TypeScript SDK for non-custodial wallet signing with EIP-7702 gasless transactions.

## Quick Start

```bash
npm install @zerodev/wallet-react @zerodev/wallet-core wagmi viem
```

```typescript
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { zeroDevWallet, useRegisterPasskey, OAUTH_PROVIDERS } from '@zerodev/wallet-react'

// 1. Configure Wagmi
const config = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevWallet({
      projectId: 'your-project-id',
      chains: [sepolia],
    })
  ],
  transports: {
    [sepolia.id]: http('your-rpc-url'),
  },
})

// 2. Authenticate
function LoginPage() {
  const registerPasskey = useRegisterPasskey()
  const authenticateOAuth = useAuthenticateOAuth()

  return (
    <>
      <button onClick={() => registerPasskey.mutate()}>
        Register with Passkey
      </button>
      <button onClick={() => authenticateOAuth.mutate({ provider: OAUTH_PROVIDERS.GOOGLE })}>
        Login with Google
      </button>
    </>
  )
}

// 3. Use standard Wagmi hooks
function Dashboard() {
  const { address } = useConnection()
  const { sendTransaction } = useSendTransaction()
  const { disconnect } = useDisconnect()

  return (
    <>
      <p>Address: {address}</p>
      <button onClick={() => sendTransaction({ to: '0x...', value: parseEther('0.01') })}>
        {/* Gasless if configured on dashboard (UserOp under the hood) */}
        Send Transaction
      </button>
      <button onClick={() => disconnect()}>Logout</button>
    </>
  )
}
```

See [React package README](./packages/react/README.md) for full documentation.

For framework-agnostic usage, see [@zerodev/wallet-core](./packages/core/README.md).

If you'd rather not build your own auth and signing UI, use
[@zerodev/wallet-react-kit](./packages/react-kit/README.md) — drop-in
React components (`<AuthFlow />`, `<SignatureRequest />`) built on top of
this SDK.

## Authentication Methods

### Passkey (WebAuthn)

Hardware-backed authentication using biometrics or security keys.

```typescript
const registerPasskey = useRegisterPasskey()
const loginPasskey = useLoginPasskey()

// Register new passkey
registerPasskey.mutate()

// Login with existing passkey
loginPasskey.mutate()
```

### OAuth (Google)

Social login with Google. The backend handles PKCE and token exchange — no client-side OAuth library needed.

```typescript
const authenticateOAuth = useAuthenticateOAuth()

// Opens popup, SDK handles everything automatically
authenticateOAuth.mutate({ provider: OAUTH_PROVIDERS.GOOGLE })
```

### Email Magic Link

Passwordless authentication via email link.

```typescript
const sendMagicLink = useSendMagicLink()
const verifyMagicLink = useVerifyMagicLink()

// Send magic link
const { otpId } = await sendMagicLink.mutateAsync({
  email: 'user@example.com',
  redirectURL: 'https://yourapp.com/verify',
})

// With custom OTP code settings
const { otpId } = await sendMagicLink.mutateAsync({
  email: 'user@example.com',
  redirectURL: 'https://yourapp.com/verify',
  otpCodeCustomization: { length: 8, alphanumeric: false },
})

// Verify (on /verify page, extract code from URL)
const code = new URLSearchParams(window.location.search).get('code')
await verifyMagicLink.mutateAsync({ otpId, code })
```

### Email OTP

One-time password sent to email.

```typescript
const sendOTP = useSendOTP()
const verifyOTP = useVerifyOTP()

// Send OTP code
const { otpId } = await sendOTP.mutateAsync({
  email: 'user@example.com'
})

// With custom OTP code settings
const { otpId } = await sendOTP.mutateAsync({
  email: 'user@example.com',
  otpCodeCustomization: { length: 8, alphanumeric: false },
})

// Verify OTP code
await verifyOTP.mutateAsync({
  code: '12345678',
  otpId,
})
```

### OTP Code Customization

Both `sendOTP` and `sendMagicLink` accept an optional `otpCodeCustomization` parameter to configure the generated code:

| Field | Type | Description |
|---|---|---|
| `length` | `6 \| 7 \| 8 \| 9` | Code length (default: 6) |
| `alphanumeric` | `boolean` | Use alphanumeric characters instead of digits only (default: false) |

```typescript
otpCodeCustomization: {
  length: 8,        // 8-digit code
  alphanumeric: false, // numeric only
}
```

## Send Transaction

Transactions are sent as UserOperations under the hood (EIP-7702). Gasless if a paymaster is configured on the [ZeroDev dashboard](https://dashboard.zerodev.app).

```typescript
import { useSendTransaction } from 'wagmi'
import { parseEther } from 'viem'

const { sendTransaction } = useSendTransaction()

// Gasless if configured on dashboard (UserOp under the hood)
sendTransaction({
  to: '0x...',
  value: parseEther('0.01'),
})
```

## Export Wallet

Export your wallet's seed phrase for backup or import into other wallets.

```typescript
import { useExportWallet } from '@zerodev/wallet-react'

function ExportButton() {
  const exportWallet = useExportWallet()

  return (
    <>
      <div id="export-container" />
      <button
        onClick={() => exportWallet.mutate({ iframeContainerId: 'export-container' })}
        disabled={exportWallet.isPending}
      >
        Export Seed Phrase
      </button>
    </>
  )
}
```

## Export Private Key

Export your wallet account's private key for backup or import into other wallets.

```typescript
import { useExportPrivateKey } from '@zerodev/wallet-react'

function ExportButton() {
  const exportPrivateKey = useExportPrivateKey()

  return (
    <>
      <div id="export-container" />
      <button
        onClick={() => exportPrivateKey.mutate({ iframeContainerId: 'export-container' })}
        disabled={exportPrivateKey.isPending}
      >
        Export Private Key
      </button>
    </>
  )
}
```

## Development

### Setup

```bash
# Clone repository
git clone git@github.com:offchainlabs/doorway-kms-sdk.git
cd doorway-kms-sdk

# Install dependencies
pnpm install

# Build
pnpm build
```

### Project Structure

```
zerodev-wallet-sdk/
├── packages/
│   ├── core/              # Framework-agnostic core SDK
│   │   ├── src/
│   │   │   ├── actions/   # API actions (auth, wallet, signing)
│   │   │   ├── client/    # HTTP client & transport
│   │   │   ├── stampers/  # Key management (iframe, indexedDB, webauthn)
│   │   │   ├── storage/   # Session storage
│   │   │   ├── core/      # Main SDK (createZeroDevWallet)
│   │   │   └── types/     # TypeScript types
│   │   └── dist/          # Compiled output
│   ├── react/             # React hooks & Wagmi connector
│   │   ├── src/
│   │   │   ├── hooks/     # React hooks (useRegisterPasskey, etc.)
│   │   │   ├── actions.ts # Action functions
│   │   │   ├── connector.ts # Wagmi connector
│   │   │   └── provider.ts  # EIP-1193 provider
│   │   └── dist/          # Compiled output
│   └── react-kit/         # Drop-in React UI components
│       ├── src/
│       │   ├── auth/      # <AuthFlow /> + auth pages and hooks
│       │   ├── signing/   # <SignatureRequest /> + signing hooks
│       │   ├── shared/    # Shared components and utilities
│       │   └── connector.ts # Enhanced wagmi connector (zeroDevWallet)
│       └── dist/          # Compiled output
└── README.md
```

## License

MIT

## Links

- **Website:** [zerodev.app](https://zerodev.app)
- **Documentation:** [docs.zerodev.app](https://docs.zerodev.app)
- **Demo:** [Live Demo](https://zerodev-signer-demo.vercel.app/) | [Source](./apps/zerodev-signer-demo)

## Packages

- **[@zerodev/wallet-react-kit](./packages/react-kit)** — Drop-in React UI components (`<AuthFlow />`, `<SignatureRequest />`) and enhanced wagmi connector
- **[@zerodev/wallet-react](./packages/react)** — React hooks and Wagmi connector (recommended for React apps)
- **[@zerodev/wallet-core](./packages/core)** — Core SDK (framework-agnostic)
