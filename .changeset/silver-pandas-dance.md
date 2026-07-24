---
"@zerodev/react-ui": patch
---

feat: promote `Section` and `MessageDetails` from `wallet-react-ui`'s internal `signing/components/*` to the public `@zerodev/react-ui` package barrel so other consumers (smart-routing-address-react-ui, etc.) can reuse them.

- `Section` — the collapsible/static bordered panel with a title, leading icon, and optional chevron toggle. Props (`title`, `iconName`, `collapsible`, `children`) unchanged.
- `MessageDetails` — thin wrapper that renders a `Section` (`title="Message Details"`, `iconName="message"`) plus a `DataRow` per entry in `details`, with camelCase keys title-cased inline (no more dependency on `wallet-react-ui`'s `camelCaseToTitle` util).
