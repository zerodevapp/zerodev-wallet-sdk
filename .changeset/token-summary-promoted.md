---
'@zerodev/react-ui': patch
---

feat: promote `TokenSummary` to a shared primitive

The portfolio-value hero (Figma "Portfolio Value": token-logo tile
overhanging a card, fiat value large, crypto amount beneath) moves out of
wallet-react-ui's shared components into react-ui, exported as
`TokenSummary` / `TokenSummaryProps`.
