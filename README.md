# ZeroDev Wallet SDK

[![CI](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml)

TypeScript SDK for non-custodial wallet signing powered by Turnkey's secure infrastructure with EIP-7702 gasless transactions.

## Packages

- **[@zerodev/wallet-react](./packages/react)** - React hooks and Wagmi connector (recommended for React apps)
- **[@zerodev/wallet-core](./packages/core)** - Core SDK (framework-agnostic)

## Quick Start

### For React/Next.js Apps (Recommended)

Use the Wagmi connector for seamless integration:

```bash
npm install @zerodev/wallet-react @zerodev/wallet-core wagmi viem
```

```typescript
import { createConfig } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { zeroDevWallet, useRegisterPasskey, OAUTH_PROVIDERS } from '@zerodev/wallet-react'

// 1. Configure Wagmi
const config = createConfig({
  chains: [sepolia],
  connectors: [
    zeroDevWallet({
      projectId: 'your-project-id',
      aaUrl: 'your-aa-provider-url',
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
      <button onClick={() => registerPasskey.mutate({ email: 'user@example.com' })}>
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
  const { sendTransaction } = useSendTransaction() // Automatically gasless!
  const { disconnect } = useDisconnect()

  return (
    <>
      <p>Address: {address}</p>
      <button onClick={() => sendTransaction({ to: '0x...', value: parseEther('0.01') })}>
        Send Gasless Transaction
      </button>
      <button onClick={() => disconnect()}>Logout</button>
    </>
  )
}
```

See [React package README](./packages/react/README.md) for full documentation.

### For Vanilla JS/Other Frameworks

```typescript
import { createZeroDevWallet } from '@zerodev/wallet-core';

// 1. Initialize
const wallet = await createZeroDevWallet({
  projectId: 'your-project-id',
});

// 2. Authenticate with passkey
await wallet.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'  // or 'login'
});

// 3. Get wallet account
const account = await wallet.toAccount();
console.log('Wallet:', account.address);

// 4. Sign message
const signature = await account.signMessage({
  message: 'Hello World'
});

// 5. Send transaction (using viem)
import { createWalletClient, http, parseEther } from 'viem';
import { sepolia } from 'viem/chains';

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http()
});

const hash = await walletClient.sendTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  value: parseEther('0.001')
});
```

## Authentication Methods

### Passkey (WebAuthn)

Hardware-backed authentication using biometrics or security keys.

```typescript
// Register new passkey
await wallet.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'
});

// Login with existing passkey
await wallet.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'login'
});
```

### Email Magic Link

Passwordless authentication via email.

```typescript
// Step 1: Send magic link
const { otpId } = await wallet.auth({
  type: "otp",
  mode: "sendOtp",
  email: "user@example.com",
  contact: { type: "email", contact: email },
  emailCustomization: {
    magicLinkTemplate: 'https://yourapp.com/verify?otp=%s'
  },
});

// Step 2: After user clicks link (on /verify page)
const params = new URLSearchParams(window.location.search);
const otp = params.get('otp');

await wallet.auth({
  type: "otp",
  mode: "verifyOtp",
  otpId,
  otpCode: otp,
});
```

### Email OTP

One-time password sent to email.

```typescript
// Step 1: Send OTP
const { otpId } = await wallet.auth({
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' }
});

// Step 2: Verify OTP code
await wallet.auth({
  type: 'otp',
  mode: 'verifyOtp',
  otpId,
  otpCode: '123456',
});
```

### OAuth (Google)

Social login with Google. The backend handles PKCE and token exchange - no client-side OAuth library needed.

```typescript
// React SDK (recommended)
import { useAuthenticateOAuth, OAUTH_PROVIDERS } from '@zerodev/wallet-react'

const authenticateOAuth = useAuthenticateOAuth()

// Opens popup, SDK handles everything automatically
await authenticateOAuth.mutateAsync({
  provider: OAUTH_PROVIDERS.GOOGLE
})

// Core SDK
await wallet.auth({
  type: 'oauth',
  provider: 'google'
})
```

## Session Management

```typescript
// Get current session
const session = await wallet.getSession();
console.log('User ID:', session.userId);
console.log('Expires:', new Date(session.expiry));

// Refresh session (extend expiry)
const refreshed = await wallet.refreshSession();

// Get all sessions
const allSessions = await wallet.getAllSessions();
Object.values(allSessions).forEach(session => {
  console.log(`Session ${session.id}: ${session.stamperType}`);
});

// Switch session
await wallet.switchSession(sessionId);

// Clear specific session
await wallet.clearSession(sessionId);

// Logout (clear all)
await wallet.logout();
```

## Export Wallet

Export your wallet's seed phrase for backup or import into other wallets.

**Prerequisites:** You must have a container element in your DOM for the export iframe:
```html
<div id="export-container"></div>
```

**Important:** The export uses Turnkey's secure iframe to decrypt and display the seed phrase. The SDK returns an encrypted bundle that only the export iframe can decrypt.

```typescript
import { createIframeStamper, exportWallet } from '@zerodev/wallet-core';

// 1. Create export iframe stamper
// Note: The container element MUST exist in DOM before this call
const exportIframeStamper = await createIframeStamper({
  iframeUrl: 'https://export.turnkey.com',
  iframeContainer: document.getElementById('export-container'),
  iframeElementId: 'export-iframe'
});

// 2. Initialize iframe and get target public key
const targetPublicKey = await exportIframeStamper.init();

// 3. Call SDK to get encrypted export bundle
const { exportBundle, organizationId } = await exportWallet({
  wallet,
  targetPublicKey
});

// 4. Inject bundle into iframe (iframe will decrypt and show seed phrase)
await exportIframeStamper.injectWalletExportBundle(exportBundle, organizationId);

// The iframe now displays the seed phrase in the 'export-container' div
```

**Security Note:** The seed phrase never passes through your JavaScript code - it's decrypted inside Turnkey's iframe for maximum security.

## Export Private Key

Export your wallet account's private key for backup or import into other wallets.

**Prerequisites:** You must have a container element in your DOM for the export iframe:
```html
<div id="export-container"></div>
```

```typescript
import { createIframeStamper, exportPrivateKey } from '@zerodev/wallet-core';

// 1. Create export iframe stamper
const exportIframeStamper = await createIframeStamper({
  iframeUrl: 'https://export.turnkey.com',
  iframeContainer: document.getElementById('export-container'),
  iframeElementId: 'export-iframe'
});

// 2. Initialize iframe and get target public key
const targetPublicKey = await exportIframeStamper.init();

// 3. Call SDK to get encrypted export bundle
const { exportBundle, organizationId } = await exportPrivateKey({
  wallet,
  targetPublicKey,
  // address: '0x...' // Optional: specify address, defaults to wallet's account
});

// 4. Inject bundle into iframe (iframe will decrypt and show private key)
await exportIframeStamper.injectKeyExportBundle(exportBundle, organizationId, 'Hexadecimal');

// The iframe now displays the private key in the 'export-container' div
```

### React Hook

```typescript
import { useExportPrivateKey } from '@zerodev/wallet-react';

function ExportButton() {
  const exportPrivateKey = useExportPrivateKey();

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
  );
}
```

**Security Note:** The private key never passes through your JavaScript code - it's decrypted inside Turnkey's iframe for maximum security.

## Configuration

```typescript
interface ZeroDevWalletConfig {
  // Required
  projectId: string;

  // Optional
  organizationId?: string;           // Turnkey organization ID
  proxyBaseUrl?: string;             // KMS backend URL (default: http://localhost:3001/api/v1)
  iframeUrl?: string;                // Turnkey iframe URL (default: https://auth.turnkey.com)
  iframeContainer?: HTMLElement;     // Custom iframe container element
  iframeElementId?: string;          // Custom iframe element ID
  sessionStorage?: StorageAdapter;   // Custom storage implementation
  rpId?: string;                     // WebAuthn Relying Party ID (default: window.location.hostname)
}
```

### Custom Storage Adapter

```typescript
import type { StorageAdapter } from '@zerodev/wallet-core';

const customStorage: StorageAdapter = {
  getItem: async (key: string) => {
    // Implement: return stored value or null
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    // Implement: store value
    localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    // Implement: remove value
    localStorage.removeItem(key);
  }
};
```

## TypeScript

Full type definitions included:

```typescript
import type {
  ZeroDevWalletSDK,
  ZeroDevWalletConfig,
  ZeroDevWalletSession,
  ZeroDevWalletClient,
  AuthParams,
  StamperType,
  SessionType,
  StorageAdapter
} from '@zerodev/wallet-core';
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

### Local Development

```bash
# Link the package locally
cd packages/core
pnpm link

# In your project
cd /path/to/your-project
pnpm link @zerodev/wallet-core
```

### Project Structure

```
zerodev-wallet-sdk/
├── packages/
│   └── core/              # Main SDK package
│       ├── src/
│       │   ├── actions/   # API actions (auth, wallet, signing)
│       │   ├── client/    # HTTP client & transport
│       │   ├── stampers/  # Key management (iframe, indexedDB, webauthn)
│       │   ├── storage/   # Session storage
│       │   ├── core/      # Main SDK (createZeroDevWallet)
│       │   └── types/     # TypeScript types
│       └── dist/          # Compiled output
└── README.md
```

## License

MIT

## Links

- **Website:** [zerodev.app](https://zerodev.app)
- **Documentation:** [docs.zerodev.app](https://docs.zerodev.app)
- **Demo:** [GitHub - zerodev-wallet-demo](https://github.com/zerodevapp/zerodev-signer-demo)
- **Turnkey:** [turnkey.com](https://turnkey.com)
