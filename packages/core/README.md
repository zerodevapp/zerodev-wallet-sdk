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
  mode: 'register'
});

// Login with existing passkey
await wallet.auth({
  type: 'passkey',
  mode: 'login'
});
```

### Email Magic Link

```typescript
// Send magic link
const { otpId } = await wallet.auth({
  type: 'magicLink',
  mode: 'send',
  email: 'user@example.com',
  redirectURL: 'https://yourapp.com/verify',
});

// With custom OTP code settings
const { otpId } = await wallet.auth({
  type: 'magicLink',
  mode: 'send',
  email: 'user@example.com',
  redirectURL: 'https://yourapp.com/verify',
  otpCodeCustomization: { length: 8, alphanumeric: false },
});

// After user clicks link (on /verify page), extract code from URL
const code = new URLSearchParams(window.location.search).get('code');
await wallet.auth({
  type: 'magicLink',
  mode: 'verify',
  otpId,
  code,
});
```

### Email OTP

```typescript
// Step 1: Send OTP code
const { otpId } = await wallet.auth({
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' }
});

// With custom OTP code settings
const { otpId } = await wallet.auth({
  type: 'otp',
  mode: 'sendOtp',
  email: 'user@example.com',
  contact: { type: 'email', contact: 'user@example.com' },
  otpCodeCustomization: { length: 8, alphanumeric: false },
});

// Step 2: Verify OTP code
await wallet.auth({
  type: 'otp',
  mode: 'verifyOtp',
  otpId,
  otpCode: '12345678',
});
```

### OTP Code Customization

Both OTP and magic link `send` modes accept an optional `otpCodeCustomization` parameter:

| Field | Type | Description |
|---|---|---|
| `length` | `6 \| 7 \| 8 \| 9` | Code length (default: 6) |
| `alphanumeric` | `boolean` | Use alphanumeric characters instead of digits only (default: false) |

### OAuth (Google)

```typescript
// Backend handles PKCE and token exchange - no client-side OAuth library needed
await wallet.auth({
  type: 'oauth',
  provider: 'google'
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

## React Native

On React Native there are no browser defaults for key storage, passkeys, or
session storage, so those fields are **required**. The package ships ready-made
native adapters behind granular subpaths (so apps using alternative adapters
skip the unused peer-dep installs):

```typescript
import { createZeroDevWallet } from '@zerodev/wallet-core';
import { createSecureStoreStamper } from '@zerodev/wallet-core/react-native/stampers/secure-store';
import { createReactNativePasskeyStamper } from '@zerodev/wallet-core/react-native/stampers/passkey';
import { asyncStorageAdapter } from '@zerodev/wallet-core/react-native/storage/async-storage';

const RP_ID = 'your-app.example.com'; // must match your assetlinks/AASA domain

const wallet = await createZeroDevWallet({
  projectId: 'your-project-id',
  rpId: RP_ID,
  apiKeyStamper: createSecureStoreStamper(),
  passkeyStamper: createReactNativePasskeyStamper({ rpId: RP_ID }),
  sessionStorage: asyncStorageAdapter,
});
```

- `createSecureStoreStamper()` — API-key stamper backed by `expo-secure-store`.
- `createReactNativePasskeyStamper({ rpId })` — passkey stamper backed by `@turnkey/react-native-passkey-stamper`.
- `asyncStorageAdapter` — session storage backed by `@react-native-async-storage/async-storage`.

### Peer dependencies (React Native)

These are optional peer deps, pulled in only when you import the native
subpaths above:

```bash
npm install expo-secure-store @turnkey/react-native-passkey-stamper \
  @turnkey/api-key-stamper @turnkey/crypto \
  @react-native-async-storage/async-storage \
  react-native-get-random-values uuid
# or
yarn add expo-secure-store @turnkey/react-native-passkey-stamper \
  @turnkey/api-key-stamper @turnkey/crypto \
  @react-native-async-storage/async-storage \
  react-native-get-random-values uuid
# or
pnpm add expo-secure-store @turnkey/react-native-passkey-stamper \
  @turnkey/api-key-stamper @turnkey/crypto \
  @react-native-async-storage/async-storage \
  react-native-get-random-values uuid
```

Import the crypto polyfill once at your app's entry point, before any SDK call:

```typescript
import 'react-native-get-random-values';
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
import { createIframeStamper, exportWallet } from '@zerodev/wallet-core';

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
const { exportBundle, organizationId } = await exportWallet({
  wallet,
  targetPublicKey
});

// 4. Inject into iframe to display seed phrase
await exportIframeStamper.injectWalletExportBundle(exportBundle, organizationId);

// The seed phrase is now visible in the 'export-container' div
```

**Note:** The SDK handles Turnkey API calls. The iframe handles secure decryption and display. The seed phrase never touches your JavaScript code.

## Export Private Key

Export your wallet account's private key using Turnkey's secure iframe:

**Setup:** Add a container element to your HTML:
```html
<div id="export-container"></div>
```

**Usage:**
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

// 3. Get encrypted export bundle from SDK
const { exportBundle, organizationId } = await exportPrivateKey({
  wallet,
  targetPublicKey,
  // address: '0x...' // Optional: defaults to wallet's account address
});

// 4. Inject into iframe to display private key
await exportIframeStamper.injectKeyExportBundle(exportBundle, organizationId, 'Hexadecimal');

// The private key is now visible in the 'export-container' div
```

**Note:** The private key never touches your JavaScript code - it's decrypted inside Turnkey's iframe.

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

For React apps, see the demo implementation at [`apps/zerodev-signer-demo`](../../apps/zerodev-signer-demo).

Key patterns:
- Use React Context for SDK instance
- Handle session state with useState/useEffect
- Auto-refresh sessions in background
- Session expiry warnings

## License

MIT

## Links

- [ZeroDev](https://zerodev.app)
- [GitHub](https://github.com/zerodevapp/doorway-kms-sdk)
