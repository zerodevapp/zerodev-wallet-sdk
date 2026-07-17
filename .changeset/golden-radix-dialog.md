---
"@zerodev/react-ui": patch
---

feat: rewrite `QrModal` on `@radix-ui/react-dialog` (new peer dependency) and introduce two new APIs to make card-scoped overlays composable:

- **`useScreenOverlayContainer()`** — hook that returns the `Screen`'s inner card element (populated after mount via context). Card-scoped overlays (bottom sheets, dialogs) portal into this container instead of `document.body`, so they stay clipped inside the rounded frame while the state can live anywhere in the tree.
- **`<SheetShell>`** — thin Radix Dialog wrapper that supplies the bottom-sheet chrome (backdrop, positioning, `data-state`-driven open/close animation) and the `useScreenOverlayContainer()` portal target. Consumers own the sheet body.

BREAKING (`Screen`): removed the `overlay` prop. That prop required the parent to own overlay state AND render `Screen`, which broke composition (e.g. an overlay whose state lives in a child of `Screen` was impossible). Migrate by rendering the overlay component as a child of `Screen` — `<SheetShell>` (or any consumer of `useScreenOverlayContainer()`) will portal it back into the card frame.

`QrModal` API is now `{ open, onOpenChange, address, onCopy }`. Radix owns focus trap, ESC, backdrop dismissal, `aria-modal`, and mount-through-exit-animation. Open/close animation is CSS-only via `data-[state=open|closed]` variants bound to Tailwind keyframes (`sheet-in` / `sheet-out` / `backdrop-in` / `backdrop-out`).
