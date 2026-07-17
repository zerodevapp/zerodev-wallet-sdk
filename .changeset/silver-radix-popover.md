---
"@zerodev/react-ui": patch
---

refactor: rewrite `SelectDropdown` on top of `@radix-ui/react-popover` (new peer dependency). Radix now owns focus management, keyboard navigation, click-outside, ESC dismissal, portaling, and ARIA wiring — replacing the hand-rolled equivalents.

API changes:
- Removed `anchorRef` (dropped the parent-ref timing dance that never worked reliably).
- Added `align?: 'start' | 'center' | 'end'` — forwarded to Radix `Popover.Content`.
- Panel width now defaults to trigger width via Radix's `--radix-popover-trigger-width` variable. Wider panels (e.g. spanning two pills in a row) are done via the new `panelWidth` prop, e.g. `panelWidth="calc(var(--radix-popover-trigger-width) * 2 + 4px)"`. `panelWidth` is applied inline so it beats any class-based width.
- Removed the `logoInitial` field from `SelectDropdownItem` — `PillItem` derives the initial from `symbol` internally.

Also: `Wrapper` and `PillItem` now accept a `ref` prop (needed for Radix `Popover.Trigger asChild`), and `PillItem` renders its chevron whenever `!disabled` rather than gating on `onClick`, so it looks correct when wrapped in an external interactive parent.
