---
"@zerodev/smart-routing-address-react-ui": patch
"@zerodev/react-ui": patch
---

fix: extend the scoped CSS reset to SRA

- `@zerodev/smart-routing-address-react-ui`'s `styles.css` no longer ships
  Tailwind's preflight (a global element reset that restyled the consumer's
  page) or named `@layer`s (layered SDK styles lose to a Tailwind host app
  whose own layers happen to be declared later) — all SDK styling now stays
  inside the `.zd-scope` boundary, matching react-ui and wallet-react-ui.
- react-ui's scoped reset strips native input chrome from text-like fields
  (`appearance: none`) while checkbox/radio chrome survives (`appearance:
  auto` carve-out), and the boundary element's own reset drops to zero
  specificity (`:where(.zd-scope)`).
