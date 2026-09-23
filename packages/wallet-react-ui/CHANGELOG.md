# @zerodev/wallet-react-ui

## 0.0.13

### Patch Changes

- 3ac022b: fix: no stray back arrow after signing in with an external wallet and logging out

  `goToStep(null)` now clears the step history. Ending the flow used to push the
  current step onto the history, and an external wallet's disconnect never runs
  the kit's `reset()`, so the next open of the widget showed a back arrow that
  led nowhere.

- c1b16c0: design: SRA widget design-review pass, second round

  react-ui:

  - `TokenSummary` promoted from wallet-react-ui's internals and generalized:
    `fiatValue`/`cryptoAmount` become display-agnostic
    `primaryValue`/`secondaryValue` (secondary now optional), and the tile
    gains an optional `badgeLogoUrl` chain badge.
  - `ProgressStep` marks restyle per the design: 18px, done = soft orange disc
    with an orange check (was solid orange/white), connector at full orange.
  - `SelectIcon` chevron rotates to face up while the panel is open, animated
    both ways.
  - Every info affordance switches to the thin `info-outline` glyph at 14px —
    `DataRow` used it for warning rows only, `ProgressStep` and the fee rows
    used the filled 12px disc.
  - `info-outline` glyph rotated 180° so the dot sits above the stem.

  smart-routing-address-react-ui:

  - Transaction-details page redesigned (Figma 20002:37994): single delivered
    hero via `TokenSummary` (destination token tile + chain badge) replaces
    the source→destination card pair, plus a "From" row with the deposited
    amount; network-row chain logos bump to 18px and the explorer link's icon
    inherits the link's ink. The design's fiat secondary line is omitted — SRA
    fee estimates carry no USD pricing.
  - Deposit rows report the terminal state as "Delivered"; the interim
    "Received" status is gone.
  - "Estimated fee" / "Total fee" values are clickable as a whole (not just
    the arrow) and their disclosure chevron animates with open state.
  - The "Arrives as" destination-chain pill skeletons alongside the token pill
    while the route loads.

- ee8de5e: fix: magic-link verification no longer dead-ends on `/verify?code=…`

  - The persisted OTP session is now restored before base connector setup.
    Verification raced the restore: `auth.initialize()` (a synchronous
    localStorage read) only ran after `await connector.setup?.()`, whose async
    work (wallet creation, session validation) could be slow or fail.
    `Verifying` reads the session once on mount, so landing on the magic link
    before the restore finished stripped the code from the URL and silently
    dropped the flow. The restore now runs first, synchronously inside wagmi's
    `createConfig`, so the session is always in the store before any React
    effect can observe it.
  - Opening a magic link with no pending OTP session (expired, already used,
    or a browser that never started the email flow) now shows a "Link
    Expired" error with a path back to sign-in, instead of stripping the code
    and rendering nothing.

- 71e9acf: fix: say when the wallet is still holding an earlier connection request

  Closing a wallet popup without answering leaves the request open in the
  extension. The wallet answers the next attempt with EIP-1193 `-32002` instead
  of prompting again, which the connecting page reported as a failure — often as
  raw JSON-RPC text, or `[object Object]` when the wallet threw a bare object.

  That case now reads "Request waiting in {wallet}", rendered as a waiting state
  rather than an error, and tells the user to approve or dismiss the request from
  the wallet's toolbar icon before trying again.

  Any error object without a usable message now falls back to a plain sentence
  with its numeric code, so `[object Object]` can no longer reach the screen.

- a746117: fix: declining an external wallet connection now says so

  Rejecting the request in the wallet returned the user to the sign-in options
  with no explanation. The connecting page now shows "Request declined" with the
  wallet's name, and offers Try again alongside the other sign-in methods.

  A rejection is also recognised in every shape wallets throw it: an `Error`
  carrying EIP-1193 `code: 4001` with a generic name, the raw JSON-RPC object
  wagmi's injected connector rethrows, or either nested under `cause`. Only
  viem's named error was matched before, so a rejection from those wallets was
  reported as a failure.

- c28a1b3: fix: picking an external wallet no longer freezes the sign-up page

  A wallet that is locked, or whose popup the user closed without answering,
  never replies to `connect()`. The sign-up page disabled every button while that
  request was pending, so it sat frozen with no message and no way out.

  Picking an external wallet now moves to a `wallet-connecting` step that names
  the wallet it is waiting on and always offers a way back to the other sign-in
  methods. The page owns the `connect()` call, so a wallet approved after the
  user leaves still closes the widget, and re-picking a wallet whose request is
  still open re-adopts it rather than sending one the wallet would reject. A
  failure that is not a user rejection is reported on the page instead of the
  sign-up screen that used to show it.

- Updated dependencies [c1b16c0]
- Updated dependencies [eccfccb]
  - @zerodev/react-ui@0.0.9

## 0.0.12

### Patch Changes

- 2fe1800: feat: WalletConnect pairing for external wallets

  wallet-react-ui:

  - New export `zeroDevWalletConnect` — WalletConnect connector preconfigured
    for the kit.
  - New sign-up unit `SignUp.WalletConnect` — generic pairing row with a QR
    sheet.
  - `SignUp.Wallet` and `SignUp.MoreWallets` open a WalletConnect pairing
    sheet (QR + deep link) for wallets not present in the browser; on mobile,
    signing requests deep-link into the connected wallet app.
  - fix: duplicate wallet entries in wallet in-app browsers; expired pairing
    proposals now surface an error with retry.

  ```tsx
  connectors: [
    zeroDevWallet({ ... }),
    zeroDevWalletConnect({ projectId: 'your-reown-project-id' }),
  ]

  <SignUp>
    <SignUp.InstalledWallets />
    <SignUp.WalletConnect />
    <SignUp.MoreWallets />
  </SignUp>
  ```

  react-ui:

  - New export: `QrCode` (+ `QrCodeProps`). Adds the `uqr` dependency.

- b3eaf7c: feat: `useWalletInfo` + WalletConnect compat fixes

  - New `useWalletInfo` hook: identity of the wallet behind the active wagmi
    connection. Call-compatible with AppKit's `useWalletInfo` (same name, same
    `{ walletInfo }` return shape, optional ignored namespace arg), so
    migrating from AppKit is an import swap. `walletInfo` carries
    `{ name, icon, walletId, source }`, or is `undefined` while disconnected.
    Injected wallets resolve from the
    connector, WalletConnect connections from the session's peer metadata
    (the actual wallet on the other end, resolved asynchronously), the
    embedded wallet reports `source: 'embedded'`.
  - `zustand` moved from peerDependencies to dependencies in both packages.
    The kit's store never crosses into host code, so there is no singleton to
    share — as a peer it only produced unmet-peer warnings for hosts on
    zustand 4.
  - Test mocks for wagmi's `useConnect` now match its real return shape
    (`connect`, not `mutate`), keeping the suite valid on wagmi v2 and v3.

- Updated dependencies [2fe1800]
- Updated dependencies [2fe1800]
- Updated dependencies [b3eaf7c]
  - @zerodev/react-ui@0.0.8
  - @zerodev/wallet-react@0.0.8

## 0.0.11

### Patch Changes

- 0b7ba46: fix: stop applying a global CSS reset to the host app

  `styles.css` shipped Tailwind's preflight, a global reset that hit every
  element on the consumer's page: margins, heading sizes, button chrome, fonts.
  All SDK styling now stays inside a `.zd-scope` boundary.

  The SDK's CSS is deliberately not wrapped in `@layer`: unlayered author CSS
  beats all layered CSS, so the widget styling holds up in a Tailwind host app
  regardless of stylesheet import order (a layered version would lose to the
  host's preflight whenever the host's layers happen to be declared later).

- Updated dependencies [0b7ba46]
  - @zerodev/react-ui@0.0.7

## 0.0.10

### Patch Changes

- Updated dependencies [82781ea]
  - @zerodev/wallet-core@0.0.5
  - @zerodev/wallet-react@0.0.7

## 0.0.9

### Patch Changes

- Updated dependencies [118ad87]
- Updated dependencies [a609a7d]
- Updated dependencies [dfb4daa]
- Updated dependencies [2757a61]
  - @zerodev/react-ui@0.0.6
  - @zerodev/wallet-react@0.0.6
  - @zerodev/wallet-core@0.0.4

## 0.0.8

### Patch Changes

- feac477: feat: sign in with external wallets from the SignUp page

  New composable units on the `SignUp` compound. Connecting an external wallet
  makes it the active wagmi connection and closes the embedded-wallet flow.

  - `SignUp.Wallet` pins one wallet as its own row. `walletId` is the new
    `WalletId` union (e.g. `'metamask'`): the row connects when a live connector
    claims the wallet (browser extension or configured SDK connector, with an
    INSTALLED badge for announced extensions) and links to the vendor's download
    page otherwise.
  - `SignUp.InstalledWallets` auto-discovers announced (EIP-6963) extensions:
    one badged row per wallet, nothing when none are installed.
    `excludeWalletIds` hides wallets by guide id or rdns (dedupe against a
    pinned `SignUp.Wallet` row); `maxWallets` caps the list (default 4, known
    wallets ranked first).
  - `SignUp.MoreWallets` adds a row that opens an overlay sheet with the full
    wallet grid — every known wallet plus any other live connector.
  - New exported type `WalletId`; `AuthMethod` gains `'external-wallet'`.

  ```tsx
  <SignUp>
    <SignUp.Email />
    <SignUp.Divider />
    <SignUp.Wallet walletId="metamask" />
    <SignUp.InstalledWallets excludeWalletIds={["metamask"]} />
    <SignUp.MoreWallets />
  </SignUp>
  ```

## 0.0.7

### Patch Changes

- 483abc2: feat: composable sign-up via `<SignUp>` and rename `AuthFlow` → `ConnectWallet`

  The auth UI is now assembled by composition instead of connector config. Which
  methods appear — and how — is decided by the components you render, not an
  `enabledMethods` array.

  - `<ConnectWallet>` (was `AuthFlow`) renders the active auth step. New props:
    `renderSignUp` (supply your own `SignUp` composition), `logo` (brand mark in
    the top nav — moved off the connector), plus the existing `size` / `onClose`.
  - New `<SignUp>` compound export — the sign-up page as composable units:
    `SignUp.Default` (canonical page), `SignUp.Passkey`, `SignUp.Google`,
    `SignUp.Email`, `SignUp.Divider`. The root owns the consent gate
    (`termsAndConditionsUrl` / `privacyPolicyUrl`) and the email flow
    (`emailAuthMethod`), and disables sibling methods while one is in flight.
  - New `EmailAuthMethod` type (`'magicLink' | 'otp'`).
  - The sign-up card now fits its content (fewer methods → shorter card) up to
    the standard height.

  ```tsx
  // default page, configured
  <ConnectWallet
    logo={<YourLogo />}
    renderSignUp={() => (
      <SignUp.Default emailAuthMethod="otp" termsAndConditionsUrl="…" />
    )}
  />

  // or compose your own
  <ConnectWallet
    renderSignUp={() => (
      <SignUp emailAuthMethod="otp">
        <SignUp.Google />
        <SignUp.Divider />
        <SignUp.Email />
      </SignUp>
    )}
  />
  ```

- Updated dependencies [8769b2c]
  - @zerodev/wallet-core@0.0.3
  - @zerodev/wallet-react@0.0.5

## 0.0.6

### Patch Changes

- Updated dependencies [8bd66e2]
- Updated dependencies [c8dceeb]
- Updated dependencies [e7f08b4]
- Updated dependencies [b41535d]
  - @zerodev/wallet-react@0.0.4
  - @zerodev/wallet-core@0.0.2
  - @zerodev/react-ui@0.0.5

## 0.0.5

### Patch Changes

- Updated dependencies [61aaa41]
- Updated dependencies [51b0199]
- Updated dependencies [07fd578]
- Updated dependencies [4d08a5e]
  - @zerodev/react-ui@0.0.4

## 0.0.4

### Patch Changes

- dba45ee: Widened wagmi and @wagmi/core peer dependency ranges to ^2.19.0 || ^3.0.0 and ^2.22.0 || ^3.0.0 respectively.
- Updated dependencies [fbab121]
- Updated dependencies [107915a]
- Updated dependencies [7e6a682]
  - @zerodev/react-ui@0.0.3
  - @zerodev/wallet-react@0.0.3

## 0.0.3

### Patch Changes

- Updated dependencies [4590297]
  - @zerodev/wallet-react@0.0.2

## 0.0.2

### Patch Changes

- feat: AuthFlow now accepts an optional size prop ('sm' | 'md' | 'lg') to render the wallet UI at small/medium/large scale, backed by @zerodev/react-ui's density-scaled sizing. Backward compatible — omitting size keeps the previous default.

- Updated dependencies
  - @zerodev/react-ui@0.0.2

## 0.0.1

Initial public release.

- Prebuilt React wallet UI kit for ZeroDev: drop-in `AuthFlow` login UI and the `zeroDevWallet` kit connector, built on `@zerodev/wallet-react`.
- `useAuth` hook to drive the auth flow; ships its own stylesheet (`@zerodev/wallet-react-ui/styles.css`).
- Depends on `@zerodev/wallet-core`, `@zerodev/wallet-react`, and `@zerodev/react-ui` (all `0.0.1`).
