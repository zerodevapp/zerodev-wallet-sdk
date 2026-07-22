---
"@zerodev/react-ui": patch
---

feat: rewrite `QrModal` on Radix Dialog (via the `radix-ui` umbrella peer dependency) and ship a shadcn-style set of composable sheet primitives:

- **`BottomSheet`** — `Dialog.Root` re-export; consumer holds the `open`/`onOpenChange` state here.
- **`BottomSheetContent`** — bottom-anchored chrome (portal + backdrop + slide-up panel with `data-[state]` animations). Only takes `children` and `className`.
- **`BottomSheetTitle`** — styled `Dialog.Title`, `sr-only` by default for a11y; consumers who want a visible header render their own heading inside `BottomSheetContent`.
- **`BottomSheetClose`** — `Dialog.Close` re-export; wrap any action button in it and it dismisses the sheet.

Usage:

```tsx
<BottomSheet open={isOpen} onOpenChange={setIsOpen}>
  <BottomSheetContent>
    <BottomSheetTitle>{title}</BottomSheetTitle>
    {content}
    <BottomSheetClose asChild>
      <Button text="Cancel" />
    </BottomSheetClose>
  </BottomSheetContent>
</BottomSheet>
```

`QrModal` composes these internally; its public API stays `{ open, onOpenChange, address, onCopy }`. Radix owns focus trap, ESC, backdrop dismissal, `aria-modal`, and mount-through-exit-animation. Open/close animation is CSS-only via `data-[state=open|closed]` variants bound to Tailwind keyframes (`sheet-in` / `sheet-out` / `backdrop-in` / `backdrop-out`).

BREAKING (`Screen`): removed the `overlay` prop — sheets now render as children of `Screen` and portal themselves into the card frame via `useScreenOverlayContainer()`.
