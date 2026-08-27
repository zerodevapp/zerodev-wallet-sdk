---
"@zerodev/smart-routing-address-react-ui": patch
"@zerodev/react-ui": patch
"@zerodev/wallet-react-ui": patch
---

fix: extend the scoped CSS reset to SRA and make it host-proof

- `@zerodev/smart-routing-address-react-ui`'s `styles.css` no longer ships
  Tailwind's preflight (a global element reset that restyled the consumer's
  page) — all SDK styling now stays inside the `.zd-scope` boundary,
  matching react-ui and wallet-react-ui.
- The SDK stylesheets no longer wrap their CSS in named `@layer`s. Layered
  SDK styles lose to a Tailwind host app whose own layers happen to be
  declared later (the host's preflight then zeroes every `zd:` padding /
  margin — widgets collapsed edge-to-edge). Unlayered author CSS beats all
  layered CSS, so SDK styling now wins regardless of stylesheet import
  order. The scoped reset imports before the utilities so utilities keep
  winning specificity ties.
- react-ui's scoped reset gains the `ol`/`ul` list rule (`list-style:
  none`) the SRA deposit lists relied on preflight for, and native
  checkbox/radio chrome now survives the reset (`appearance: auto`
  carve-out).
