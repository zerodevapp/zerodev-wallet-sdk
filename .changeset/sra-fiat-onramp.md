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

- New optional `onramp` config (`{ getWidgetUrl }`). When set, the deposit
  screen shows a "Buy with card" button (Figma `20400:2514`) above the Send
  card that opens the Transak on-ramp in an in-widget bottom sheet,
  pre-filled with the selected token/network and locked to the deposit
  address. Omitted → nothing renders, keeping the entry invisible for
  partners without Transak access. `getWidgetUrl` is called on every press:
  Transak requires widget URLs minted by its server-side session API (the
  partner secret can't ship to browsers, and session URLs are single-use
  with a 5-minute expiry), so the host implements the mint on its backend —
  the sra-demo `app/api/transak-session` route is the reference recipe.
- The deposit screen's "Copy Address" button now reuses react-ui's small
  `Button` instead of hand-rolled styling.
