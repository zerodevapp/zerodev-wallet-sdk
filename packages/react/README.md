# @zerodev/wallet-react

React hooks and Wagmi connector for ZeroDev Wallet SDK with EIP-7702 gasless transactions.

## Features

- **Wagmi Integration** - Works seamlessly with the Wagmi ecosystem
- **Multiple Auth Methods** - Passkey (WebAuthn), Email OTP, OAuth (Google)
- **Gasless Transactions** - All transactions are gasless via EIP-7702
- **Session Management** - Auto-refresh with configurable thresholds
- **Multi-Chain** - Lazy kernel account creation per chain
- **TypeScript** - Full type safety with proper generics
- **React Query** - Built on TanStack Query for optimal UX

## Installation

```bash
npm install @zerodev/wallet-react @zerodev/wallet-core wagmi viem
# or
yarn add @zerodev/wallet-react @zerodev/wallet-core wagmi viem
# or
pnpm add @zerodev/wallet-react @zerodev/wallet-core wagmi viem
```

## Quick Start

### 1. Configure Wagmi

```typescript
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { zeroDevWallet } from '@zerodev/wallet-react'

const config = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevWallet({
      projectId: 'YOUR_PROJECT_ID',
      chains: [sepolia],
    })
  ],
  transports: {
    [sepolia.id]: http('YOUR_RPC_URL'),
  },
})
```

### 2. Wrap Your App

```typescript
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <YourApp />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### 3. Authenticate Users

```typescript
import { useRegisterPasskey, useAuthenticateOAuth, OAUTH_PROVIDERS } from '@zerodev/wallet-react'

function LoginPage() {
  const registerPasskey = useRegisterPasskey()
  const authenticateOAuth = useAuthenticateOAuth()

  return (
    <>
      <button
        onClick={() => registerPasskey.mutate()}
        disabled={registerPasskey.isPending}
      >
        {registerPasskey.isPending ? 'Registering...' : 'Register with Passkey'}
      </button>

      <button
        onClick={() => authenticateOAuth.mutate({ provider: OAUTH_PROVIDERS.GOOGLE })}
        disabled={authenticateOAuth.isPending}
      >
        {authenticateOAuth.isPending ? 'Authenticating...' : 'Login with Google'}
      </button>
    </>
  )
}
```

### 4. Use Standard Wagmi Hooks

```typescript
import { useConnection, useSendTransaction, useDisconnect } from 'wagmi'
import { parseEther } from 'viem'

function Dashboard() {
  const { address } = useConnection()
  const { sendTransaction } = useSendTransaction()
  const { disconnect } = useDisconnect()

  return (
    <>
      <p>Address: {address}</p>

      <button onClick={() =>
        sendTransaction({
          to: '0x...',
          value: parseEther('0.01')
        })
      }>
        Send Gasless Transaction
      </button>

      <button onClick={() => disconnect()}>
        Logout
      </button>
    </>
  )
}
```

## Authentication Methods

### Passkey (WebAuthn)

```typescript
const registerPasskey = useRegisterPasskey()
const loginPasskey = useLoginPasskey()

// Register new passkey
await registerPasskey.mutateAsync()

// Login with existing passkey
await loginPasskey.mutateAsync()
```

### OAuth (Google)

```typescript
const authenticateOAuth = useAuthenticateOAuth()

// Opens popup, backend handles PKCE and token exchange
// No callback page or OAuth library needed - SDK handles everything
await authenticateOAuth.mutateAsync({
  provider: OAUTH_PROVIDERS.GOOGLE
})
```

### Email Magic Link

```typescript
const sendMagicLink = useSendMagicLink()
const verifyMagicLink = useVerifyMagicLink()

// Send magic link
const { otpId } = await sendMagicLink.mutateAsync({
  email: 'user@example.com',
  redirectURL: 'https://yourapp.com/verify',
})

// Verify (on /verify page, extract code from URL)
const code = new URLSearchParams(window.location.search).get('code')
await verifyMagicLink.mutateAsync({ otpId, code })
```

### Email OTP

```typescript
const sendOTP = useSendOTP()
const verifyOTP = useVerifyOTP()

// Send OTP code
const { otpId } = await sendOTP.mutateAsync({
  email: 'user@example.com'
})

// Verify OTP code
await verifyOTP.mutateAsync({
  code: '123456',
  otpId,
})
```

## Configuration Options

```typescript
type ZeroDevWalletConnectorParams = {
  projectId: string                    // Required: Your ZeroDev project ID
  organizationId?: string               // Optional: Turnkey organization ID
  proxyBaseUrl?: string                 // Optional: KMS proxy URL
  chains: readonly Chain[]              // Required: Supported chains
  rpId?: string                         // Optional: WebAuthn RP ID
  sessionStorage?: StorageAdapter       // Optional: Custom session storage
  autoRefreshSession?: boolean          // Optional: Auto-refresh (default: true)
  sessionWarningThreshold?: number      // Optional: Refresh threshold in ms (default: 60000)
}
```

## Advanced Usage

### Custom Callbacks

```typescript
const registerPasskey = useRegisterPasskey({
  mutation: {
    onSuccess: () => {
      console.log('Registration successful!')
      router.push('/dashboard')
    },
    onError: (error) => {
      console.error('Registration failed:', error)
      analytics.track('auth_failed', { method: 'passkey' })
    }
  }
})
```

### Manual Session Refresh

```typescript
const refreshSession = useRefreshSession()

await refreshSession.mutateAsync({})
```

### Export Wallet (Seed Phrase)

```typescript
const exportWallet = useExportWallet()

// Container element must exist: <div id="export-container" />
await exportWallet.mutateAsync({
  iframeContainerId: 'export-container'
})
```

### Export Private Key

```typescript
const exportPrivateKey = useExportPrivateKey()

// Container element must exist: <div id="export-container" />
await exportPrivateKey.mutateAsync({
  iframeContainerId: 'export-container'
})
```

### Get User Email

```typescript
const getUserEmail = useGetUserEmail()

// Fetch user's email from the backend
const { email } = await getUserEmail.mutateAsync({
  organizationId: session.organizationId,
  projectId: 'your-project-id'
})
```

## API Reference

### Hooks

All hooks follow the TanStack Query mutation pattern:

- `useRegisterPasskey()` - Register with passkey
- `useLoginPasskey()` - Login with passkey
- `useAuthenticateOAuth()` - OAuth (Google popup)
- `useSendMagicLink()` - Send magic link via email
- `useVerifyMagicLink()` - Verify magic link code
- `useSendOTP()` - Send OTP via email
- `useVerifyOTP()` - Verify OTP code
- `useRefreshSession()` - Manually refresh session
- `useExportWallet()` - Export wallet seed phrase
- `useExportPrivateKey()` - Export wallet private key
- `useGetUserEmail()` - Get user's email address

### Connector

- `zeroDevWallet(params)` - Wagmi connector factory

### Constants

- `OAUTH_PROVIDERS.GOOGLE` - Google OAuth provider constant

### Types

- `OAuthProvider` - OAuth provider type
- `ZeroDevWalletConnectorParams` - Connector parameters
- `ZeroDevWalletState` - Store state type
- `ZeroDevProvider` - EIP-1193 provider type

## License

MIT
