# @zerodev/wallet-react-ui

## 1.0.0

### Patch Changes

- Updated dependencies [118ad87]
- Updated dependencies [a609a7d]
- Updated dependencies [dfb4daa]
- Updated dependencies [2757a61]
  - @zerodev/react-ui@0.0.6
  - @zerodev/wallet-react@1.0.0
  - @zerodev/wallet-core@0.1.0

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
