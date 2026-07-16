# @zerodev/wallet-react-ui

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
