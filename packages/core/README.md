# @zerodev/signer-core

TypeScript SDK for managing wallet signing keys with Turnkey's non-custodial infrastructure.

## Features

- Multiple authentication methods (Passkey, Email, OTP, OAuth)
- Non-custodial key management via Turnkey
- Automatic session refresh
- Multi-session support
- viem integration for Ethereum operations
- TypeScript with full type safety

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

// 1. Initialize the SDK
const signer = await createZeroDevSigner({
  projectId: 'your-project-id',
});

// 2. Authenticate with passkey
await signer.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'  // or 'login' for existing users
});

// 3. Get wallet account (viem LocalAccount)
const account = await signer.toAccount();
console.log('Wallet address:', account.address);

// 4. Sign a message
const signature = await account.signMessage({
  message: 'Hello World'
});

// 5. Send a transaction
import { createWalletClient, http } from 'viem';
import { sepolia } from 'viem/chains';

const walletClient = createWalletClient({
  account,
  chain: sepolia,
  transport: http()
});

const hash = await walletClient.sendTransaction({
  to: '0x...',
  value: parseEther('0.001')
});
```

## Authentication Methods

### Passkey (WebAuthn)

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

```typescript
// Send magic link
await signer.auth({
  type: 'email',
  email: 'user@example.com',
  emailCustomization: {
    magicLinkTemplate: 'https://yourapp.com/verify?bundle=%s'
  }
});

// After user clicks link, inject bundle
await signer.auth({
  type: 'email',
  bundle: bundleFromUrl  // From magic link URL
});
```

### Email OTP

```typescript
// Step 1: Send OTP code
const data = await signer.auth({
  type: 'otp',
  mode: 'register',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' }
});

// Step 2: Verify OTP code
await signer.auth({
  type: 'otp',
  mode: 'login',
  otpId: data.otpId,
  otpCode: '123456',
  subOrganizationId: data.subOrganizationId
});
```

### OAuth (Google)

```typescript
// After getting credential from Google OAuth
await signer.auth({
  type: 'oauth',
  provider: 'google',
  credential: googleCredential  // JWT from Google
});
```

## Session Management

```typescript
// Get active session
const session = await signer.getSession();
console.log('Session expires:', new Date(session.expiry));

// Refresh session (extends expiry)
const newSession = await signer.refreshSession();

// Get all sessions
const allSessions = await signer.getAllSessions();

// Switch to different session
await signer.switchSession(sessionId);

// Clear specific session
await signer.clearSession(sessionId);

// Logout (clear all sessions)
await signer.logout();
```

## Configuration Options

```typescript
interface ZeroDevSignerConfig {
  projectId: string;                  // Required: Your project ID
  organizationId?: string;            // Turnkey organization ID
  proxyBaseUrl?: string;              // KMS backend URL
  iframeUrl?: string;                 // Turnkey iframe URL (default: auth.turnkey.com)
  iframeContainer?: HTMLElement;      // Custom iframe container
  iframeElementId?: string;           // Custom iframe element ID
  sessionStorage?: StorageAdapter;    // Custom storage (default: localStorage)
  rpId?: string;                      // WebAuthn RP ID (default: window.location.hostname)
}
```

## Custom Storage

```typescript
import { createZeroDevSigner, type StorageAdapter } from '@zerodev/signer-core';

// Implement custom storage (e.g., IndexedDB, AsyncStorage)
const customStorage: StorageAdapter = {
  getItem: async (key: string) => {
    // Your implementation
    return value;
  },
  setItem: async (key: string, value: string) => {
    // Your implementation
  },
  removeItem: async (key: string) => {
    // Your implementation
  }
};

const signer = await createZeroDevSigner({
  projectId: 'your-project-id',
  sessionStorage: customStorage
});
```

## TypeScript Types

```typescript
import type {
  ZeroDevSignerSDK,
  ZeroDevSignerConfig,
  ZeroDevSignerSession,
  AuthParams,
  StamperType
} from '@zerodev/signer-core';
```

## React Integration

For React apps, see the demo implementation at [zerodev-signer-demo](https://github.com/OffchainLabs/doorway-auth-prototype).

Key patterns:
- Use React Context for SDK instance
- Handle session state with useState/useEffect
- Auto-refresh sessions in background
- Session expiry warnings

## License

MIT

## Links

- [ZeroDev](https://zerodev.app)
- [Turnkey](https://turnkey.com)
- [GitHub](https://github.com/zerodevapp/doorway-kms-sdk)
