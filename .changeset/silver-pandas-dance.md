---
"@zerodev/react-ui": patch
---

feat: promote `Section`, `MessageDetails`, and the `camelCaseToTitle` string util from `wallet-react-ui`'s internal `signing/components/*` and `shared/utils/common.ts` to the public `@zerodev/react-ui` package barrel so other consumers (smart-routing-address-react-ui, etc.) can reuse them.

- `Section` — the collapsible/static bordered panel with a title, leading icon, and optional chevron toggle. Props (`title`, `iconName`, `collapsible`, `children`) unchanged.
- `MessageDetails` — thin wrapper that renders a `Section` (`title="Message Details"`, `iconName="message"`) plus a `DataRow` per entry in `details`, using `camelCaseToTitle` on the keys.
- `camelCaseToTitle(str)` — turn `"fromAddress"` into `"From Address"`; leaves already-cased strings (starting with uppercase) unchanged.
