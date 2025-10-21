# @zerodev/wallet-core

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
npm install @zerodev/wallet-core
# or
yarn add @zerodev/wallet-core
# or
pnpm add @zerodev/wallet-core
```

## Quick Start

```typescript
import { createZeroDevWallet } from '@zerodev/wallet-core';

// 1. Initialize the SDK
const wallet = await createZeroDevWallet({
  projectId: 'your-project-id',
});

// 2. Authenticate with passkey
await wallet.auth({
  type: 'passkey',
  email: 'user@example.com',
  mode: 'register'  // or 'login' for existing users
});

// 3. Get wallet account (viem LocalAccount)
const account = await wallet.toAccount();
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

```typescript
// Send magic link
await wallet.auth({
  type: "otp",
  mode: "sendOtp",
  email: "user@example.com",
  contact: { type: "email", contact: email },
  emailCustomization: {
    magicLinkTemplate: 'https://yourapp.com/verify?otp=%s'
  },
});

// After user clicks link, parse otp from url params
await wallet.auth({
  type: "otp",
  mode: "verifyOtp",
  otpId,
  otpCode: otp, // OTP from magic link url
  subOrganizationId,
});
```

### Email OTP

```typescript
// Step 1: Send OTP code
const data = await wallet.auth({
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' }
});

// Step 2: Verify OTP code
await wallet.auth({
  type: 'otp',
  mode: 'verifyOtp',
  otpId: data.otpId,
  otpCode: '123456',
  subOrganizationId: data.subOrganizationId
});
```

### OAuth (Google)

```typescript
// After getting credential from Google OAuth
await wallet.auth({
  type: 'oauth',
  provider: 'google',
  credential: googleCredential  // JWT from Google
});
```

## Session Management

```typescript
// Get active session
const session = await wallet.getSession();
console.log('Session expires:', new Date(session.expiry));

// Refresh session (extends expiry)
const newSession = await wallet.refreshSession();

// Get all sessions
const allSessions = await wallet.getAllSessions();

// Switch to different session
await wallet.switchSession(sessionId);

// Clear specific session
await wallet.clearSession(sessionId);

// Logout (clear all sessions)
await wallet.logout();
```

## Configuration Options

```typescript
interface ZeroDevWalletConfig {
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
import { createZeroDevWallet, type StorageAdapter } from '@zerodev/wallet-core';

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

const wallet = await createZeroDevWallet({
  projectId: 'your-project-id',
  sessionStorage: customStorage
});
```

## Export Wallet

Export your wallet's seed phrase using Turnkey's secure iframe:

**Setup:** Add a container element to your HTML:
```html
<div id="export-container"></div>
```

**Usage:**
```typescript
import { createIframeStamper } from '@zerodev/wallet-core';

// 1. Create export iframe stamper
// IMPORTANT: Container element must exist in DOM first!
const exportIframeStamper = await createIframeStamper({
  iframeUrl: 'https://export.turnkey.com',
  iframeContainer: document.getElementById('export-container'),
  iframeElementId: 'export-iframe'
});

// 2. Initialize iframe and get target public key
const targetPublicKey = await exportIframeStamper.init();

// 3. Get encrypted export bundle from SDK
const { exportBundle, organizationId } = await wallet.exportWallet(targetPublicKey);

// 4. Inject into iframe to display seed phrase
await exportIframeStamper.injectWalletExportBundle(exportBundle, organizationId);

// The seed phrase is now visible in the 'export-container' div
```

**Note:** The SDK handles Turnkey API calls. The iframe handles secure decryption and display. The seed phrase never touches your JavaScript code.

## TypeScript Types

```typescript
import type {
  ZeroDevWalletSDK,
  ZeroDevWalletConfig,
  ZeroDevWalletSession,
  AuthParams,
  StamperType,
  ExportWalletParameters,
  ExportWalletReturnType
} from '@zerodev/wallet-core';
```

## React Integration

For React apps, see the demo implementation at [zerodev-wallet-demo](https://github.com/zerodevapp/zerodev-signer-demo).

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
