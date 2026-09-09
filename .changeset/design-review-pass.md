---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
---

design: SRA widget design-review pass

react-ui:

- `TokenSummary` promoted from wallet-react-ui's internals and generalized:
  `fiatValue`/`cryptoAmount` become display-agnostic
  `primaryValue`/`secondaryValue` (secondary now optional), and the tile
  gains an optional `badgeLogoUrl` chain badge.
- `ProgressStep` marks restyle per the design: 18px, done = soft orange disc
  with an orange check (was solid orange/white), connector at full orange.
- `SelectIcon` chevron rotates to face up while the panel is open, animated
  both ways.
- `DataRow` warning variant keeps label/value in default ink — only the
  card tint stays orange — and its info icon switches to the new thin
  `info-outline` glyph (orange, half opacity).
- New icons: `info-outline`, `clock-fill`; `line-loading` replaced with the
  design's rays glyph (the old hairline stroke was invisible at small sizes).

smart-routing-address-react-ui:

- Transaction-details page redesigned (Figma 20002:37994): single delivered
  hero via `TokenSummary` (destination token tile + chain badge) replaces
  the source→destination card pair, plus a "From" row with the deposited
  amount; network-row chain logos bump to 18px. The design's fiat secondary
  line is omitted — SRA fee estimates carry no USD pricing.
- `TxnItem`: detailed variant for past-deposit rows, "Received" renamed to
  "Delivered", routing rows spin the rays glyph, design spacing.
- "Estimated fee" / "Total fee" values are clickable as a whole (not just
  the arrow) and their disclosure chevron animates with open state.
- Active-deposits card: retitled "Active Deposit", design paddings/row gaps,
  no more doubled left inset on tappable rows.
- Past-deposits row became a ghost-Wrapper card with the orange `clock-fill`
  icon, 18px title, and hover treatment.
- New full-width dark "Copy Address" button under the deposit address.
- "Watching for your deposit…" only renders once the address exists, and the
  "Arrives as" destination-chain pill skeletons alongside the token pill
  while the route loads.
- Deposit page honours its bottom padding when content scrolls
  (`h-full` → `min-h-full`).
