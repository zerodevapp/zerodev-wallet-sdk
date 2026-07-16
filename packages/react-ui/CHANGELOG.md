# @zerodev/react-ui

## 0.0.3

### Patch Changes

- fbab121: feat: promote `ArrowCardPair` (and `ArrowView`) to `@zerodev/react-ui`. Previously local to wallet-react-ui's signing pages; now a shared primitive available to other consumers (e.g. smart-routing-address-react-ui's Deposit flow).
- 7e6a682: feat: add DataRow primitive with `leading` / `trailing` / `info` slots and a `warning` variant. Unifies wallet-react-ui's internal DataRow and smart-routing-address-react-ui's LabeledValueRow; wallet-react-ui now consumes it from `@zerodev/react-ui`.

## 0.0.2

### Patch Changes

- feat: Density-scaled spacing system: components size from a density token instead of hardcoded pixels, with sensible default tokens built in. Enables sm/md/lg size

## 0.0.1

Initial public release.

- Shared React UI primitives (components, icons, and design tokens) used by `@zerodev/wallet-react-ui`.
