---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
---

design: SRA widget design-review pass

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
