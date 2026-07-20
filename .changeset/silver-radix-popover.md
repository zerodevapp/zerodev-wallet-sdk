---
"@zerodev/react-ui": patch
---

feat: replace the monolithic `SelectDropdown` with styled Radix Select building blocks (shadcn pattern). Consumers compose `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`, `SelectSeparator`, `SelectIcon`, and `SelectItemText` freely — nothing is token-specific anymore.

- New peer dependency: `@radix-ui/react-select` (proper `combobox`/`listbox` semantics, typeahead, native-like keyboard nav).
- Dropped peer dependency: `@radix-ui/react-popover` — no longer used.
- `SelectTrigger` supports `asChild` so callers can wrap any styled trigger (e.g. `PillItem`) without duplicating chevron/keyboard glue.
- `SelectContent` renders as a portaled popper (default position). Panel width defaults to the trigger via `--radix-select-trigger-width`; wider panels are done with inline `style={{ width: '…' }}` (e.g. `calc(var(--radix-select-trigger-width) * 2 + 4px)` to span a two-pill row).
- `SelectItem` is a bare styled row — pass `textValue` for typeahead when children aren't plain text.

Also: `Wrapper` and `PillItem` now accept a `ref` prop (needed for Radix `asChild`), and `PillItem` renders its chevron whenever `!disabled` rather than gating on `onClick`, so it looks correct when wrapped in an external interactive parent.
