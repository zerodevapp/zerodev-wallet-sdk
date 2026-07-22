---
"@zerodev/react-ui": patch
---

feat: add `Pill` and shadcn-style `Select` primitives.

- `Pill`: label + logo pill with optional `trailingIcon` slot, keyboard-accessible when `onClick` is supplied. Renders a dimmed display variant when `disabled`.
- `Select` primitives (`Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectSeparator`, `SelectIcon`, `SelectItemText`) wrap Radix `Select` with the design-system styles. `SelectTrigger` supports `asChild` so callers can wrap any styled trigger (e.g. `Pill`) without duplicating chevron/keyboard glue. `SelectContent` renders as a portaled popper; panel width defaults to the trigger via `--radix-select-trigger-width` and can be widened with an inline `style={{ width: '…' }}`. Pass `textValue` on `SelectItem` for typeahead when children aren't plain text.
- New peer dependency: `radix-ui`.
