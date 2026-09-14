---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
'@zerodev/wallet-react-ui': patch
---

design: SRA widget design-review pass, second round

react-ui:

- `TokenSummary` promoted from wallet-react-ui's internals and generalized:
  `fiatValue`/`cryptoAmount` become display-agnostic
  `primaryValue`/`secondaryValue` (secondary now optional), and the tile
  gains an optional `badgeLogoUrl` chain badge.
- `ProgressStep` marks restyle per the design: 18px, done = soft orange disc
  with an orange check (was solid orange/white), connector at full orange.
- `SelectIcon` chevron rotates to face up while the panel is open, animated
  both ways.
- Every info affordance switches to the thin `info-outline` glyph at 14px —
  `DataRow` used it for warning rows only, `ProgressStep` and the fee rows
  used the filled 12px disc.
- `info-outline` glyph rotated 180° so the dot sits above the stem.

smart-routing-address-react-ui:

- Transaction-details page redesigned (Figma 20002:37994): single delivered
  hero via `TokenSummary` (destination token tile + chain badge) replaces
  the source→destination card pair, plus a "From" row with the deposited
  amount; network-row chain logos bump to 18px and the explorer link's icon
  inherits the link's ink. The design's fiat secondary line is omitted — SRA
  fee estimates carry no USD pricing.
- Deposit rows report the terminal state as "Delivered"; the interim
  "Received" status is gone.
- "Estimated fee" / "Total fee" values are clickable as a whole (not just
  the arrow) and their disclosure chevron animates with open state.
- The "Arrives as" destination-chain pill skeletons alongside the token pill
  while the route loads.
