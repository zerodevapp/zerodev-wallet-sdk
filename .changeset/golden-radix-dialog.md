---
"@zerodev/react-ui": patch
---

feat: rewrite `QrModal` on `@radix-ui/react-dialog` (new peer dependency) and introduce two new APIs to make card-scoped overlays composable:

- **`useScreenOverlayContainer()`** — hook that returns the `Screen`'s inner card element (populated after mount via context). Card-scoped overlays (bottom sheets, dialogs) portal into this container instead of `document.body`, so they stay clipped inside the rounded frame while the state can live anywhere in the tree.
- **`<SheetShell>`** — thin Radix Dialog wrapper that supplies the bottom-sheet chrome (backdrop, positioning, `data-state`-driven open/close animation) and the `useScreenOverlayContainer()` portal target. Consumers own the sheet body.
- `QrModal` API is now `{ open, onOpenChange, address, onCopy }`. Radix owns focus trap, ESC, backdrop dismissal, `aria-modal`, and mount-through-exit-animation. Open/close animation is CSS-only via `data-[state=open|closed]` variants bound to Tailwind keyframes (`sheet-in` / `sheet-out` / `backdrop-in` / `backdrop-out`).
