---
"@zerodev/react-ui": patch
---

feat: promote `InfoCard` from `wallet-react-ui`'s internal `signing/components/InfoCard` to the public `@zerodev/react-ui` package barrel so other consumers (smart-routing-address-react-ui, etc.) can reuse it. Existing props (`title`, `subtitle`, `imageSource`, `imageStyle`, `rightElement`) are unchanged.

Adds a new `chainIconUrl?: string` prop that renders a 14px chain-badge overlay in the bottom-right corner of the token icon — same white-ring pattern as `TxnItem`'s `PairMark`. Useful for token cards that need to communicate both the token and the chain (e.g. "USDT on Ethereum").
