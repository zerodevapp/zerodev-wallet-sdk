# @zerodev/smart-routing-address-react-ui

## 0.0.4

### Patch Changes

- Updated dependencies [2fe1800]
- Updated dependencies [2fe1800]
  - @zerodev/react-ui@0.0.8

## 0.0.3

### Patch Changes

- Updated dependencies [0b7ba46]
  - @zerodev/react-ui@0.0.7

## 0.0.2

### Patch Changes

- 118ad87: feat(react-ui): promote `ProgressStep` to a shared primitive

  `ProgressStep` — one row of a vertical progress trail (status marker,
  connector line, label, info tooltip, trailing slot) — moves out of
  smart-routing-address-react-ui's `TransactionDetails` page into react-ui.

  - New exports: `ProgressStep`, `ProgressStepProps`, `ProgressStepStatus`.
  - The private `done`/`failed` booleans become a single
    `status: 'done' | 'active' | 'pending' | 'failed'` prop; `active` is new
    and renders a spinner marker for in-flight steps.
  - smart-routing-address-react-ui consumes the shared component; its
    Transaction Progress section is visually unchanged.

- a609a7d: design: SRA widget design-review pass

  react-ui:

  - `DataRow` warning variant keeps label/value in default ink — only the
    card tint stays orange — and its info icon switches to the new thin
    `info-outline` glyph (orange, half opacity).
  - New icons: `info-outline`, `clock-fill`; `line-loading` replaced with the
    design's rays glyph (the old hairline stroke was invisible at small sizes).

  smart-routing-address-react-ui:

  - Active-deposits card: retitled "Active Deposit", design paddings/row gaps,
    no more doubled left inset on tappable rows.
  - Past-deposits row became a ghost-Wrapper card with the orange `clock-fill`
    icon, 18px title, and hover treatment.
  - New full-width dark "Copy Address" button under the deposit address.
  - "Watching for your deposit…" only renders once the address exists.
  - Deposit page honours its bottom padding when content scrolls
    (`h-full` → `min-h-full`).

- 588ba64: feat: require `slippage` in `SmartRoutingAddressConfig`

  `@zerodev/smart-routing-address` 0.2.6 makes `slippage` a required
  `createSmartRoutingAddress` param (the SRA server no longer supplies a
  default), so the config field is now required too. The widget's
  "Max slippage" row always renders as a result. Pick values with care:
  tight slippage inflates `minDeposit`, which the server computes as
  ~fee / slippage.

- Updated dependencies [118ad87]
- Updated dependencies [a609a7d]
  - @zerodev/react-ui@0.0.6

## 0.0.1

### Patch Changes

- Initial public release. Ships the `SmartRoutingAddress` funding widget, the
  `SmartRoutingAddressProvider` context, and the `useSmartRoutingAddress` /
  `useDepositStatus` / `useNewDeposits` hooks — mount one component to give
  users a single deposit address that routes any supported token from any
  supported source chain into the recipient on the configured target chain,
  with live fee quotes (Across / Relay), pending + past deposit lists, and
  a per-deposit transaction-details view.

  ```tsx
  import {
    SmartRoutingAddress,
    SmartRoutingAddressProvider,
  } from "@zerodev/smart-routing-address-react-ui";
  import "@zerodev/smart-routing-address-react-ui/styles.css";
  import { arbitrum } from "viem/chains";

  <SmartRoutingAddressProvider
    config={{ projectId: "…", targetChainId: arbitrum.id }}
  >
    <SmartRoutingAddress recipient={recipient} onClose={close} />
  </SmartRoutingAddressProvider>;
  ```
