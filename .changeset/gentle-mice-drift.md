---
"@zerodev/react-ui": patch
---

feat: add `Modal` — a reusable animated bottom-sheet primitive. Slides up on open, back down on close; dim backdrop fades in/out; ESC and backdrop-click dismiss. Refactor `QrModal` to compose it. `QrModal` now takes an `open` prop (controlled) so the exit animation plays before unmount.
