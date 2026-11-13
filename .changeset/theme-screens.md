---
"@zerodev/wallet-react-ui": patch
---

Screens and components colour themselves through the semantic tokens instead of palette classes, so the upcoming themes can restyle them. Where the previous value had no token, the nearest design-system token applies: the sign-up divider, wallet-sheet tiles and skeletons move to the 10% ink tint, the QR card border to 30% ink, off-white tiles to the 80% neutral surface, and the raw-request panels to the bright surface. Small labels that sat at 60% ink or Tailwind's gray-500 (the wallet sheet's inactive tab, the pending-request count, the raw-data and method captions) take the secondary text token rather than tertiary: tertiary is 50% ink, about 3.6:1 on the light card, under the 4.5:1 small text needs.
