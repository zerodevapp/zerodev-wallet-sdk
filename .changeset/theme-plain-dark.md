---
"@zerodev/react-ui": minor
"@zerodev/wallet-react-ui": patch
---

The dark themes. The stylesheet states every plain dark value, so `data-zd-brand="plain"` with `data-zd-mode="dark"` (or `system` under a dark colour scheme) now applies; the dark surface tints follow the wallet screens in the design file. Branded dark is held back until the card's art has a dark design and keeps the light values for now. The bottom sheet sits on the card base in every theme, so it masks what it covers in dark too, and the QR code draws its own white quiet zone, so a scan never depends on the theme around it. The plain brand drops the decorative layers: the gradient border ring becomes a flat band (`bg-frame-ring`), the card glow a flat frosted surface, the sheet gradient goes, and every surface gets a 1px border, keyed on `data-zd-brand` like the colours. The animated blob above the sign-up heading is removed from every theme, branded light included, along with its 540KB video asset. The sign-up subtitle and the "Powered by" label read in the secondary text colour, as the screens specify.
