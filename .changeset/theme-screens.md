---
"@zerodev/wallet-react-ui": patch
---

Screens and components colour themselves through the semantic tokens instead of palette classes, so the upcoming themes can restyle them. Where the previous value had no token, the nearest design-system token applies: the sign-up divider, wallet-sheet tiles and skeletons move to the 10% ink tint, the QR card border to 30% ink, off-white tiles to the 80% neutral surface, and the raw-request panels to the bright surface.
