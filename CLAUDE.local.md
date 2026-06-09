# Claude — local working notes

Personal context for Claude Code in this repo. Gitignored (`*.local` rule).

## Repo layout

pnpm workspace monorepo.

- `packages/`
  - `wallet-core` — low-level SDK
  - `react` (`@zerodev/wallet-react`) — wagmi connector + provider + hooks
  - `react-kit` (`@zerodev/wallet-react-kit`) — UI components + enhanced connector
- `apps/zerodev-signer-demo` — Next.js demo app

`apps/*` depends on `packages/*` via `workspace:*` and reads from each package's `dist/`. Source changes in a package need a rebuild before the demo picks them up.

## Common commands

Run from repo root unless noted.

```bash
# Build packages (must run after package source changes)
pnpm --filter @zerodev/wallet-react build
pnpm --filter @zerodev/wallet-react-kit build

# Dev (demo with watch-rebuild of react-kit)
pnpm --filter @zerodev/signer-demo hot-dev

# Plain dev (no kit watch)
pnpm --filter @zerodev/signer-demo dev

# Prod-mode test of the demo
pnpm --filter @zerodev/signer-demo build
pnpm --filter @zerodev/signer-demo start

# Tests — run from REPO ROOT, not from the package dir
npx vitest run packages/react-kit
npx vitest run packages/react-kit/src/smart-routing

# Typecheck a package
cd packages/react-kit && npx tsc --noEmit -p tsconfig.build.json
```

## Lint / style gotchas (biome)

- `no-console` is enforced — don't ship `console.log`/`console.error` in package code. Pre-commit hook fails on violations.
- `exactOptionalPropertyTypes: true` is on:
  - Helper-component props need `className?: string | undefined`.
  - Pass conditional optional props with spreads: `{...(value && { prop: value })}`.
- Test files containing JSX must be `.tsx`, not `.ts`.

## React-kit conventions

### Flow components (`AuthFlow`, `SmartRoutingAddress`)

- Entry component owns `ScreenWrapper` + `TopNav` and dispatches the current `step` to a content page via a `renderStep()` switch.
- Pages are *pure content* — no ScreenWrapper, no TopNav, just a child div.
- State machine lives in a zustand slice (`authStoreSlice`, `smartRoutingStoreSlice`) — `step`, `stepHistory`, `goToStep`, `goBack`, `reset`.
- Internal navigation hook (`useAuth`, `useSmartRoutingFlow`) exposes the slice to the entry component. `useSmartRoutingFlow` is not in the public package exports.

### Layout pattern (signing/SRA pages)

`ScreenWrapper`'s scroll container has `padding-top: 72px` — this *reserves space* for the absolutely-positioned TopNav (top:20, height:52, ends at y=72). It does **not** add visible gap below the nav. Pages must add their own:

```tsx
<div className="flex flex-col h-full">                            {/* fills ScreenWrapper */}
  <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2">      {/* scrolls */}
    <div className="flex flex-col gap-4">                         {/* wrap cards in ONE child */}
      {/* cards */}
    </div>
  </div>
  <div>{/* sticky footer (e.g. "Got it") */}</div>
</div>
```

The inner cards must be wrapped in a single flex-col child of the scroll — putting them as direct flex children of the `overflow-y-auto` div causes flex-shrink to clip tall content (e.g. `DetailsContainer` with many `DataRow`s).

### Wrapper variants

`<Wrapper variant>` → `rgba(247, 245, 240, alpha)`:
- `ghost` = 0.2
- `soft` = 0.4 (default)
- `solid` = 0.8

### Icon usage in `<Select>` / token rows

- Prefer `iconName` (kit SVG asset) over `leadingImage` (URL).
- For URL images: the leading slot is a `size-11` (44px) white box; size the `<img>` to `size-6 object-contain` to match icon visual weight (don't use `size-full`).

### Connector (`zeroDevWallet`) auth flow

- Optimistic try-connect: `connect()` first attempts `base.connect()`. If it throws `NotAuthenticatedError` (typed class exported from `@zerodev/wallet-react`), the kit pops `SignUp` and waits for the user to authenticate, then retries.
- Never `await connector.getStore()` in `connect()` — base `isAuthorized()` deliberately skips init for perf (see `packages/react/src/core/connector.ts:401`). Pre-flighting init causes a SignUp flash on first paint of production builds.
- `isReconnecting` (set by wagmi on `reconnectOnMount`) silences the SignUp popup — silent reconnect failures must rethrow.
- All "Not authenticated" throws in core/provider use `NotAuthenticatedError` so the kit can `instanceof` check rather than substring-match.

## Smart Routing Address (SRA) — gotchas

- **Mainnet-only API.** Despite the SDK's `TOKEN_ADDRESSES` table listing testnets, the SRA manager rejects testnet `executionChainId` with `Execution chain X is not supported by this SRA manager version`. Supported IDs: `1, 42161, 8453, 81457, 56, 999, 57073, 59144, 34443, 143, 10, 137, 9745, 534352, 1868, 4217, 130, 480, 7777777`.
- **Demo uses testnet wallet + mainnet SRA.** SRA only needs the owner *address* — it doesn't transact on the owner's chain — so the demo configures `chains: [arbitrumSepolia, sepolia]` for the wallet but `smartRoutingAddress.destinationChains: [arbitrum]` / `sourceChains: [mainnet, arbitrum]`.
- **FLEX placeholder causes Across simulation revert.** Using generic `tokenType: 'ERC20'` makes the SDK resolve both src and dest tokens to `0xff…ff` — Across can't quote a route. Use a specific token type (`'USDC'`, `'USDT'`, etc.) that exists in the SDK's `TOKEN_ADDRESSES` table for both chains.
- **SDK swallows JSON-RPC error bodies.** If the API responds 200 OK with `{error: ...}` instead of `{result: ...}`, the SDK returns `undefined` instead of throwing. The hook converts this to a thrown error so React Query surfaces it.

### `useSmartRoutingAddress` hook shape

```ts
useSmartRoutingAddress({
  owner: Address,                        // required — usually useAccount().address
  destChain: Chain,                      // required — explicit, no fallback
  srcTokens: SrcToken[],                 // required
  slippage?: number,                     // default 100 (1%)
  actions?: ...,                         // default: NATIVE + ERC20 deposit-to-owner per unique srcToken tokenType
})
```

`SmartRoutingAddressConfig` (connector-level) is just `enabled` + `destinationChains`/`sourceChains` as **UI metadata** for the consumer's selectors — the hook doesn't read them as defaults.

## Useful paths

- Memory dir: `/Users/omar/.claude/projects/-Users-omar-dev-zerodev-wallet-sdk/memory/`
- Reference impl (RN/Expo): `/Users/omar/dev/temp/doorway-frontend/` — original SRA UI being ported
