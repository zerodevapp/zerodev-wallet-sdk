---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": minor
---

Theme switching. `Screen`, `ConnectWallet` and `TxHistory` take a `theme`: a preset name (`'branded-light'`, `'plain-light'`, `'branded-dark'`, `'plain-dark'`) or `{ mode, brand, tokens }`, with `mode: 'system'` following `prefers-color-scheme` and `tokens` overriding any `--zd-*` custom property. The stylesheet carries a block per complete variant keyed on the `data-zd-mode` / `data-zd-brand` attributes the surface writes, so a host can also set those attributes on an ancestor or override the properties from its own stylesheet. `ZeroDevLogo` gains `tone="auto"`, which follows the theme, and `PoweredBy` uses it. The dark variants ship once the design states their remaining values; until then a dark preset keeps the light values.
