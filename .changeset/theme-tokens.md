---
"@zerodev/react-ui": patch
"@zerodev/wallet-react-ui": patch
"@zerodev/smart-routing-address-react-ui": patch
---

Add the semantic colour token layer behind the upcoming themes: a Tailwind `@theme` block in `@zerodev/react-ui` declaring every background, text, icon and border token of the design system with the current (branded light) values, which Tailwind turns into `--zd-*` custom properties on `:root` and `zd:bg-*` / `zd:text-*` / `zd:text-icon-*` / `zd:border-*` utilities, all shipped in the compiled stylesheets so an app without a Tailwind build can use them. No component reads them yet, so nothing changes visually.
