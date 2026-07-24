---
"@zerodev/react-ui": patch
---

feat: rewrite `ListItem` around composition slots — `icon`, `subtitle`, and `trailing` take any ReactNode, so new row variants no longer grow the prop API.

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
