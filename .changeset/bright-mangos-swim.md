---
"@zerodev/react-ui": patch
---

feat: promote `Screen`, `TopNav`, and `PoweredBy` from wallet-react-ui to `@zerodev/react-ui` so other consumers (smart-routing-address-react-ui, etc.) can reuse the outer card chrome. Also refactor `ArrowCardPair` to a pure-CSS anchor between the two cards — the floating arrow now stays glued to the seam even when the two cards have unequal heights, without a ResizeObserver.

`TOP_NAV_HEIGHT` stays internal — `Screen` reads it via a relative import from `TopNav`; not re-exported from the package barrel.

BREAKING (`TopNav`): renamed props to slot-based names so the component doesn't need a new prop every time we add a left-slot icon. `onBack` / `onClose` / `onHelp` → `onLeftButtonClick` / `onRightButtonClick`, plus optional `leftButtonIcon` / `rightButtonIcon` (default `chevronLeft` / `x`). e.g. the SRA help button is now `<TopNav onLeftButtonClick={onHelp} leftButtonIcon="question" onRightButtonClick={onClose} />`.
