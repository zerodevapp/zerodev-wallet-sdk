---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
---

design: transaction-details page matches Figma 20002:37994

- `TokenSummary` generalizes for the new consumer: `fiatValue`/`cryptoAmount`
  become display-agnostic `primaryValue`/`secondaryValue` (secondary now
  optional), and the tile gains an optional `badgeLogoUrl` (chain badge).
- `ProgressStep` marks restyle per the design: 18px, done = soft orange disc
  with an orange check (was solid orange/white), connector at full orange.
- The SRA transaction-details hero drops the source→destination card pair
  for a single delivered hero via `TokenSummary` (destination token tile +
  chain badge), plus a new "From" row showing the deposited amount. The
  design's fiat secondary line is omitted — SRA fee estimates carry no USD
  pricing. Network-row chain logos bump to 18px.
