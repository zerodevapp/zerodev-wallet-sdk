---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": minor
---

Theme switching. The theme is two attributes on `<html>` (or any ancestor): `data-zd-mode` (`light`, `dark`, or `system` to follow `prefers-color-scheme`) and `data-zd-brand` (`branded` or `plain`). The stylesheet carries a `:where()` block per brand keyed on them, and any `--zd-*` custom property can be overridden from the host's stylesheet. No React API is involved: there is no `theme` prop, and no theme exports. Tooltips and dropdowns portal into the shared root under `document.body`, which inherits the theme from `<html>` like everything else. `ZeroDevLogo` gains `tone="auto"`, which follows the theme, and `PoweredBy` uses it. The dark variants ship once the design states their remaining values; until then a dark mode keeps the light values.

The `@import` of the token stylesheet now precedes `@config` in every package stylesheet: Vite inlines imports before Tailwind runs and drops one that follows another statement, which left Storybook without any token.
