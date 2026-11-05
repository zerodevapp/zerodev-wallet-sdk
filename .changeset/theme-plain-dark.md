---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": patch
---

The dark themes. The token table states every dark value, so `plain-dark` and `branded-dark` (and `mode: 'system'` under a dark colour scheme) now apply; the dark surface tints follow the wallet screens in the design file. The plain brand drops the decorative layers: the gradient border ring becomes a flat band (`bg-frame-ring`), the card glow a flat frosted surface, the sign-up blob and sheet gradient go, and every surface gets a 1px border, keyed on `data-zd-brand` like the colours. The sign-up subtitle and the "Powered by" label read in the secondary text colour, as the screens specify.
