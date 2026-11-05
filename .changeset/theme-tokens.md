---
"@zerodev/react-ui": patch
"@zerodev/wallet-react-ui": patch
"@zerodev/smart-routing-address-react-ui": patch
---

Add the semantic colour token layer behind the upcoming themes: `--zd-*` custom properties for every background, text, icon and border token of the design system, set on `:root` with the current (branded light) values, plus one `zd:` utility per token. Generated from a single table in `@zerodev/react-ui` (`pnpm gen:tokens`). No component reads them yet, so nothing changes visually.
