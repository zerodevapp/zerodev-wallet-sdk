---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
---

feat: fiat onramp (Transak) entry on the SRA widget

react-ui:

- `Button` gains a `size` prop: `lg` (default, the existing 64px/24px spec)
  and `sm` (the design system's 48px/14px row button), plus a `children`
  slot for custom content rows.
- New `google-pay` brand icon (composed from the design's exact exports);
  existing `visa` / `mastercard` / `apple-pay` marks are now consumed by the
  SRA widget.

smart-routing-address-react-ui:

- New optional `onramp` config (`{ transakApiKey, environment? }`). When
  set, the deposit screen shows a "Buy with card" button (Figma
  `20400:2514`) above the Send card that opens the Transak on-ramp in an
  in-widget bottom sheet, pre-filled with the selected token/network and
  locked to the deposit address. Omitted → nothing renders, keeping the
  entry invisible for partners without Transak access.
- The deposit screen's "Copy Address" button now reuses react-ui's small
  `Button` instead of hand-rolled styling.
