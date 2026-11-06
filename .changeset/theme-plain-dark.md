---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": patch
---

The dark themes. The token table states every dark value, so `plain-dark` and `branded-dark` (and `mode: 'system'` under a dark colour scheme) now apply; the dark surface tints follow the wallet screens in the design file. The plain brand drops the decorative layers: the gradient border ring becomes a flat band (`bg-frame-ring`), the card glow a flat frosted surface, the sheet gradient goes, and every surface gets a 1px border, keyed on `data-zd-brand` like the colours. The animated blob above the sign-up heading is removed from every theme, branded light included, along with its 540KB video asset. The sign-up subtitle and the "Powered by" label read in the secondary text colour, as the screens specify.
