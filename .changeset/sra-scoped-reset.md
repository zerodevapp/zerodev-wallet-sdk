---
"@zerodev/smart-routing-address-react-ui": patch
"@zerodev/react-ui": patch
---

fix: stop applying a global CSS reset to the host app (SRA)

Extends the scoped-reset work to `@zerodev/smart-routing-address-react-ui`:
its `styles.css` no longer ships Tailwind's preflight (a global element
reset that restyled the consumer's page) — all SDK styling now stays inside
the `.zd-scope` boundary, matching react-ui and wallet-react-ui.

react-ui's scoped reset gains the `ol`/`ul` list rule (`list-style: none`)
the SRA deposit lists relied on preflight for, and native checkbox/radio
chrome now survives the reset (`appearance: auto` carve-out from the
blanket input rule, matching preflight's behaviour).
