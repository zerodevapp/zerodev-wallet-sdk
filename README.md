# ZeroDev Signer SDK

[![CI](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/offchainlabs/doorway-kms-sdk/actions/workflows/ci.yml)

TypeScript SDK for non-custodial wallet signing powered by Turnkey's secure infrastructure.

## Features

- **Multiple Authentication Methods** - Passkey, Email Magic Link, OTP, OAuth (Google)
- **Non-Custodial** - Keys managed by Turnkey enclaves, never exposed
- **Session Management** - Auto-refresh, multi-session support
- **viem Integration** - Works seamlessly with viem for Ethereum operations
- **TypeScript** - Full type safety
- **Flexible Storage** - Custom storage adapters (localStorage, IndexedDB, etc.)

## Installation

```bash
npm install @zerodev/signer-core
# or
yarn add @zerodev/signer-core
# or
pnpm add @zerodev/signer-core
```

## Quick Start

```typescript
import { createZeroDevSigner } from '@zerodev/signer-core';

// 1. Initialize
const signer = await createZeroDevSigner({
  projectId: 'your-project-id',
});

// 2. Authenticate with passkey
await signer.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'  // or 'login'
});

// 3. Get wallet account
const account = await signer.toAccount();
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
await signer.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'
});

// Login with existing passkey
await signer.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'login'
});
```

### Email Magic Link

Passwordless authentication via email.

```typescript
// Step 1: Send magic link
const { otpId, subOrganizationId } = await signer.auth({
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

await signer.auth({
  type: "otp",
  mode: "verifyOtp",
  otpId,
  otpCode: otp,
  subOrganizationId,
});
```

### Email OTP

One-time password sent to email.

```typescript
// Step 1: Send OTP
const { otpId, subOrganizationId } = await signer.auth({
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' }
});

// Step 2: Verify OTP code
await signer.auth({
  type: 'otp',
  mode: 'verifyOtp',
  otpId,
  otpCode: '123456',
  subOrganizationId
});
```

### OAuth (Google)

Social login with Google.

```typescript
// Using @react-oauth/google or similar
import { GoogleLogin } from '@react-oauth/google';

<GoogleLogin
  onSuccess={async (response) => {
    await signer.auth({
      type: 'oauth',
      provider: 'google',
      credential: response.credential
    });
  }}
/>
```

## Session Management

```typescript
// Get current session
const session = await signer.getSession();
console.log('User ID:', session.userId);
console.log('Expires:', new Date(session.expiry));

// Refresh session (extend expiry)
const refreshed = await signer.refreshSession();

// Get all sessions
const allSessions = await signer.getAllSessions();
Object.values(allSessions).forEach(session => {
  console.log(`Session ${session.id}: ${session.stamperType}`);
});

// Switch session
await signer.switchSession(sessionId);

// Clear specific session
await signer.clearSession(sessionId);

// Logout (clear all)
await signer.logout();
```

## Configuration

```typescript
interface ZeroDevSignerConfig {
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
import type { StorageAdapter } from '@zerodev/signer-core';

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
  ZeroDevSignerSDK,
  ZeroDevSignerConfig,
  ZeroDevSignerSession,
  ZeroDevSignerClient,
  AuthParams,
  StamperType,
  SessionType,
  StorageAdapter
} from '@zerodev/signer-core';
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
pnpm link @zerodev/signer-core
```

### Project Structure

```
zerodev-signer-sdk/
├── packages/
│   └── core/              # Main SDK package
│       ├── src/
│       │   ├── actions/   # API actions (auth, wallet, signing)
│       │   ├── client/    # HTTP client & transport
│       │   ├── stampers/  # Key management (iframe, indexedDB, webauthn)
│       │   ├── storage/   # Session storage
│       │   ├── core/      # Main SDK (createZeroDevSigner)
│       │   └── types/     # TypeScript types
│       └── dist/          # Compiled output
└── README.md
```

## License

MIT

## Links

- **Website:** [zerodev.app](https://zerodev.app)
- **Documentation:** [docs.zerodev.app](https://docs.zerodev.app)
- **Demo:** [GitHub - zerodev-signer-demo](https://github.com/OffchainLabs/doorway-auth-prototype)
- **Turnkey:** [turnkey.com](https://turnkey.com)
