---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": minor
---

Theme switching. `Screen`, `ConnectWallet` and `TxHistory` take a `theme`: a preset name (`'branded-light'`, `'plain-light'`, `'branded-dark'`, `'plain-dark'`) or `{ mode, brand, tokens }`, with `mode: 'system'` following `prefers-color-scheme` and `tokens` overriding any `--zd-*` custom property. The stylesheet carries a `:where()` block per brand keyed on the `data-zd-mode` / `data-zd-brand` attributes the surface writes, so a host can also set those attributes on an ancestor (`<html>` included) or override the properties from its own stylesheet. Each `Screen` themes a portal container of its own on `document.body`, so tooltips and dropdowns follow their frame, also when the theme comes from an ancestor, and frames with different themes on one page do not interfere. `ZeroDevLogo` gains `tone="auto"`, which follows the theme, and `PoweredBy` uses it. The dark variants ship once the design states their remaining values; until then a dark preset keeps the light values.

The `@import` of the token stylesheet now precedes `@config` in every package stylesheet: Vite inlines imports before Tailwind runs and drops one that follows another statement, which left Storybook without any token.
