# @zerodev/react-ui

## 0.0.4

### Patch Changes

- 61aaa41: feat: promote `Screen`, `TopNav`, and `PoweredBy` from wallet-react-ui to `@zerodev/react-ui` so other consumers (smart-routing-address-react-ui, etc.) can reuse the outer card chrome. Also refactor `ArrowCardPair` to a pure-CSS anchor between the two cards — the floating arrow now stays glued to the seam even when the two cards have unequal heights, without a ResizeObserver.

  `TOP_NAV_HEIGHT` stays internal — `Screen` reads it via a relative import from `TopNav`; not re-exported from the package barrel.

  BREAKING (`TopNav`): renamed props to slot-based names so the component doesn't need a new prop every time we add a left-slot icon. `onBack` / `onClose` / `onHelp` → `onLeftButtonClick` / `onRightButtonClick`, plus optional `leftButtonIcon` / `rightButtonIcon` (default `chevronLeft` / `x`). e.g. the SRA help button is now `<TopNav onLeftButtonClick={onHelp} leftButtonIcon="question" onRightButtonClick={onClose} />`.

- 51b0199: feat: rewrite `QrModal` on Radix Dialog (via the `radix-ui` umbrella peer dependency) and ship a shadcn-style set of composable sheet primitives:

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

- 07fd578: feat: rewrite `ListItem` around composition slots — `icon`, `subtitle`, and `trailing` take any ReactNode, so new row variants no longer grow the prop API.

  - **`icon`** — leading tile content (an `<img>`, a brand mark, or the new `ListItemIcon` preset, which ships the standard sizing/color and merges `className` overrides).
  - **`subtitle`** — polymorphic secondary line: a plain string keeps the auto-styled text; any node (e.g. `<Badge />`) renders as-is. Replaces the separate `badgeProps`; the title column now uses a uniform `gap-1`.
  - **`trailing`** — right side of the row; the new `ListItemChevron` preset replaces the `chevron` boolean.
  - **`asChild`** — render the row into a child element (e.g. an `<a>`) via Radix Slot; the `asChild`/`children` pairing is enforced at the type level, so `children` without `asChild` is a compile error.

  ```tsx
  <ListItem
    title={wallet.name}
    icon={<ListItemIcon name="wallet" />}
    subtitle={<Badge text="INSTALLED" />}
    trailing={<ListItemChevron />}
    onClick={select}
  />

  <ListItem asChild title="Get MetaMask" trailing={<ListItemChevron />}>
    <a href={downloadUrl} target="_blank" rel="noopener noreferrer" />
  </ListItem>
  ```

  BREAKING (`ListItem`): removed `iconName`, `imageUri`, `badgeProps`, `details`, `chevron`, and the unused `alert` variant (no consumers on main or in any open PR). Former `details` content is a one-liner in the `trailing` slot (see `TxGasFees`). `ListItemProps` is now a type alias (base props intersected with the asChild union), no longer an interface — `extends ListItemProps` becomes `& ListItemProps`.

- 4d08a5e: feat: add `Pill` and shadcn-style `Select` primitives.

  - `Pill`: label + logo pill with optional `trailingIcon` slot, keyboard-accessible when `onClick` is supplied. Renders a dimmed display variant when `disabled`.
  - `Select` primitives (`Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectSeparator`, `SelectIcon`, `SelectItemText`) wrap Radix `Select` with the design-system styles. `SelectTrigger` supports `asChild` so callers can wrap any styled trigger (e.g. `Pill`) without duplicating chevron/keyboard glue. `SelectContent` renders as a portaled popper; panel width defaults to the trigger via `--radix-select-trigger-width` and can be widened with an inline `style={{ width: '…' }}`. Pass `textValue` on `SelectItem` for typeahead when children aren't plain text.
  - New peer dependency: `radix-ui`.

## 0.0.3

### Patch Changes

- fbab121: feat: promote `ArrowCardPair` (and `ArrowView`) to `@zerodev/react-ui`. Previously local to wallet-react-ui's signing pages; now a shared primitive available to other consumers (e.g. smart-routing-address-react-ui's Deposit flow).
- 7e6a682: feat: add DataRow primitive with `leading` / `trailing` / `info` slots and a `warning` variant. Unifies wallet-react-ui's internal DataRow and smart-routing-address-react-ui's LabeledValueRow; wallet-react-ui now consumes it from `@zerodev/react-ui`.

## 0.0.2

### Patch Changes

- feat: Density-scaled spacing system: components size from a density token instead of hardcoded pixels, with sensible default tokens built in. Enables sm/md/lg size

## 0.0.1

Initial public release.

- Shared React UI primitives (components, icons, and design tokens) used by `@zerodev/wallet-react-ui`.
