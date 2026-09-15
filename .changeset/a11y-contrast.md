---
'@zerodev/react-ui': patch
'@zerodev/smart-routing-address-react-ui': patch
'@zerodev/wallet-react-ui': patch
---

fix: raise secondary text and the warning icon to WCAG AA contrast

Secondary text rendered at `greyScale/50`, which measures 3.51:1 on the kit's
offWhite surface and misses AA's 4.5:1 for body text. It now renders at
`greyScale/60` (4.92:1). Icons keep `/50`: as non-text elements they only need
3:1, which that already clears.

`DataRow`'s warning info icon was `solarOrange` at 50% opacity, or 1.80:1 —
under the 3:1 floor for non-text elements. It now renders at full strength
(3.17:1).

Brand colours used as text (`orange`, `solarOrange`, `negative`, and
`positive` at 4.47:1) still fall short of 4.5:1 and need text-safe variants
from design; they are unchanged here.
