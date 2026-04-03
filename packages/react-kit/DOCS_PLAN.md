# React Kit Documentation Plan

## Overview

Replace the `apps/react-example` demo app with a Vocs documentation site. The docs serve as both documentation and interactive showcase — each UI component page embeds a live, wallet-connected example so users can see exactly how it looks and works.

## Why Vocs

- Built on React + Vite (same stack we use)
- MDX support — embed React components directly in doc pages
- Lightweight, fast, minimal config
- Used by wagmi, viem, and other web3 libraries (familiar to our target audience)
- Supports React 19 and Tailwind v4

## Location

`packages/react-kit/docs/` — co-located with the package it documents. If wallet-core or wallet-react need docs later, they get their own `docs/` too.

`apps/react-example/` stays as an internal dev testing app.

## Structure

```
packages/react-kit/docs/
├── pages/
│   ├── index.mdx                          # Landing page
│   ├── getting-started.mdx                # Installation + quick start
│   ├── configuration.mdx                  # Kit connector config (signing, CAB, etc.)
│   │
│   ├── components/
│   │   ├── signature-request.mdx          # SignatureRequest component
│   │   ├── auth-card.mdx                  # AuthCard component (future)
│   │   ├── button.mdx                     # Button component
│   │   ├── code-input.mdx                 # CodeInput component
│   │   └── ...                            # Future components
│   │
│   ├── hooks/
│   │   ├── use-pending-request.mdx        # usePendingRequest hook
│   │   └── ...                            # Future hooks
│   │
│   └── guides/
│       ├── signing-modes.mdx              # 4 usage modes explained
│       ├── custom-ui.mdx                  # Building custom confirmation UI
│       └── ...
│
├── components/                            # Shared doc components
│   ├── LiveExample.tsx                    # Wrapper for interactive examples
│   └── WalletProvider.tsx                 # Wagmi/QueryClient/Kit provider wrapper
│
├── vocs.config.ts                         # Vocs configuration
├── package.json
└── tsconfig.json
```

## Pages

### Landing Page (`index.mdx`)
- What react-kit is
- Quick code snippet showing minimal setup
- Links to getting started, components, hooks

### Getting Started (`getting-started.mdx`)
- Install: `pnpm add @zerodev/wallet-react-kit`
- Peer deps: `@zerodev/wallet-react`, `wagmi`, `zustand`, `viem`, `react`
- Minimal setup:
  ```tsx
  import { zeroDevKitWallet } from '@zerodev/wallet-react-kit'
  
  const config = createConfig({
    connectors: [
      zeroDevKitWallet({
        projectId: '...',
        chains: [sepolia],
      }),
    ],
  })
  ```
- First component mount

### Configuration (`configuration.mdx`)
- `ZeroDevKitConnectorParams` — all config options
- `config.signing` — modes (`prompt` vs `background`), custom methods
- Future: `config.chainAbstraction`, etc.
- Type reference with descriptions

### Component Pages (e.g. `signature-request.mdx`)
Each component page follows the same structure:
1. **What it does** — one paragraph
2. **Import** — `import { SignatureRequest } from '@zerodev/wallet-react-kit'`
3. **Live example** — embedded, wallet-connected, interactive
4. **Props** — table of props with types and defaults
5. **Usage patterns** — code snippets for each usage mode
6. **Related** — links to relevant hooks, guides

### Hook Pages (e.g. `use-pending-request.mdx`)
1. **What it does**
2. **Import**
3. **Return value** — table of returned properties
4. **Example usage**
5. **Related components**

## Interactive Examples

The key differentiator — each component page embeds a live example where the user can:
1. Connect a wallet (via the kit connector)
2. Interact with the component (click send, see confirmation, confirm/reject)
3. See the result

### How it works

A shared `WalletProvider` component wraps examples with wagmi + query client + kit connector:

```tsx
// docs/components/WalletProvider.tsx
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  )
}
```

A `LiveExample` wrapper provides consistent styling:

```tsx
// docs/components/LiveExample.tsx
export function LiveExample({ children }: { children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-6 bg-gray-50 mt-4">
      <WalletProvider>
        {children}
      </WalletProvider>
    </div>
  )
}
```

Then in MDX:

```mdx
import { LiveExample } from '../components/LiveExample'
import { SignatureRequest } from '@zerodev/wallet-react-kit'

## Live Example

<LiveExample>
  <SignatureRequestDemo />
</LiveExample>
```

Where `SignatureRequestDemo` is a small component that includes a send button + the SignatureRequest component — same pattern as our current demo app.

## Sidebar Navigation

```
Getting Started
Configuration
Components
  ├── SignatureRequest
  ├── Button
  ├── CodeInput
  └── ...
Hooks
  ├── usePendingRequest
  └── ...
Guides
  ├── Signing Modes
  ├── Custom UI
  └── ...
```

## Considerations

- **Authentication in docs**: Users need to auth to test components. We could use a demo project ID or let users enter their own.
- **KMS proxy**: Same CORS issue as the demo app. Vocs dev server may need a proxy config, or we use a public-facing staging endpoint.
- **Tailwind**: react-kit components use Tailwind. The docs site needs to include the kit's CSS (`@zerodev/wallet-react-kit/styles.css`).
- **Versioning**: Vocs supports versioned docs. Not needed now, useful later.
- **Search**: Vocs has built-in search. No extra setup.
- **Deploy**: Static output — deploy to Vercel, Netlify, or GitHub Pages.

## What NOT to include (yet)

- Components that don't exist yet (AuthCard, SwapCard, etc.) — add pages when they're built
- react-native-kit docs — separate site or section later
- Core package docs — those have their own README
- API reference auto-generation — manual for now, automate later

## Next Steps

1. Set up `apps/docs/` with Vocs
2. Create WalletProvider + LiveExample wrappers
3. Write getting-started and configuration pages
4. Add SignatureRequest page with live example
5. Add existing component pages (Button, CodeInput)
6. Add usePendingRequest hook page
7. Deploy to Vercel/Netlify
