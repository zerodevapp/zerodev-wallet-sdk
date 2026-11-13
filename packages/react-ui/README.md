# @zerodev/react-ui

React UI primitives for ZeroDev — the shared component layer that
[`@zerodev/wallet-react-ui`](../wallet-react-ui/README.md) is built on. Frosted-glass surfaces,
buttons, inputs, icons, and other building blocks, styled with a fixed ZeroDev
look via Tailwind CSS v4.

These are **opinionated, branded primitives** (not a generic design system): the
ZeroDev palette and type scale are baked in. They're domain-agnostic, though —
nothing here knows about wallets or web3.

## Installation

```bash
pnpm add @zerodev/react-ui react react-dom
```

> `react` and `react-dom` (v18 or v19) are **peer dependencies**.

## Setup

Import the stylesheet once at your app entry point — it ships the compiled
Tailwind output including the ZeroDev design tokens:

```tsx
import '@zerodev/react-ui/styles.css'
```

## Usage

```tsx
import { Button, Callout, Switch, Icon } from '@zerodev/react-ui'

function Example() {
  return (
    <>
      <Callout title="Heads up" description="Review before continuing." />
      <Button text="Confirm" action="primary" iconName="check" />
      <Switch value onValueChange={() => {}} />
      <Icon name="wallet" className="w-6 h-6 text-solarOrange" />
    </>
  )
}
```

## Components

| Export | Description |
| --- | --- |
| `Wrapper` | Frosted-glass surface primitive (`ghost` / `soft` / `solid` variants). Most other components compose it. |
| `WrappedPressable` | Interactive (pressable) frosted surface for arbitrary children. |
| `Button` | Labeled call-to-action with `primary` / `secondary` actions and optional leading/trailing icon. |
| `IconButton` | Square icon-only button. |
| `Icon` | SVG icon renderer; resolves icons by name from the bundled icon set. |
| `ZeroDevLogo` | ZeroDev brand logo. `variant` `mark` (icon) or `lockup` (icon + wordmark); `tone` `black` / `offwhite` / `color` / `orange` (`lockup` supports only `black` / `offwhite`). |
| `Input` | Text / multiline input with `default` / `ghost` / `listItemStyle` variants. |
| `Switch` | On/off toggle (`role="switch"`). |
| `Badge` | Pill label with optional leading/trailing icons. |
| `ListItem` | Row with leading icon/image, title/subtitle/badge, and trailing details or chevron. Ships `ListItemSkeleton`. |
| `Callout` | Info callout box (icon + title + description). |
| `Text` | Polymorphic text primitive (`p` / `span` / `label` / `a`). |

### Utilities

| Export | Description |
| --- | --- |
| `cn` | `clsx` + `tailwind-merge` class-name combiner. |
| `icons` | The name → component map backing `<Icon />`. |

Every component exports its prop type (e.g. `ButtonProps`, `IconProps`,
`WrapperVariant`).

## Design tokens

Styling is driven by Tailwind CSS v4. The token source ships with the package
(`tailwind.config.ts`), exposing the ZeroDev palette and type scale — e.g.
`solarOrange`, `offWhite`, `greyScale`, and the `text-body1..4` / `text-h1..3`
text utilities — which the components reference. Consuming apps that use Tailwind
can scan this package's source (the published `src/` is included for that
purpose) to pick up the same tokens.

### Semantic colour tokens

`src/theme/tokens.css` is the single source of truth for every themed colour,
mirroring the "ZeroDev Design System" Figma collection: a 2×2 grid, light or
dark × branded or plain. There is no generator. The file has three parts:

1. A `@theme inline` block aliasing each token to a Tailwind colour
   namespace, so Tailwind turns it into a utility: `zd:bg-neutral-primary`,
   `zd:text-neutral-secondary`, `zd:text-icon-brand-primary`,
   `zd:border-neutral-primary`. A component writes those and never a value.
   Opacity modifiers (`zd:bg-neutral-primary/50`) and variants
   (`zd:hover:bg-error-bold`) work as for any colour. Each utility reads the
   `--zd-<token>` custom property directly.
2. The values: one `:where()` block per brand (`:root` carries branded, the
   default), and a `color-scheme` rule per mode. A host restyles the UI by
   overriding the `--zd-*` properties, from a stylesheet or inline.
3. One `@source inline` line that safelists every token utility.

### Theming

The theme is two attributes on `<html>` (or any ancestor) plus the `--zd-*`
custom properties. Only the ZeroDev stylesheet reads them, so they change
the wallet UI and nothing else. There is no `theme` prop and no React API.

- `data-zd-mode`: `light`, `dark`, or `system` (follows
  `prefers-color-scheme`).
- `data-zd-brand`: `branded` keeps the ZeroDev look; `plain` folds the
  brand onto neutrals.

**One fixed look**

```html
<html data-zd-mode="light" data-zd-brand="plain">
```

**Follow the host app's dark mode**, where it already sets its own:

```ts
document.documentElement.classList.toggle('dark', dark) // the host's own
document.documentElement.dataset.zdMode = dark ? 'dark' : 'light'
```

```tsx
<ThemeProvider attribute={['class', 'data-zd-mode']} /> // next-themes
```

or `data-zd-mode="system"` in the HTML, and the OS decides.

Write the attributes into the server-rendered `<html>` (next-themes injects
a script that does this before the first paint). An effect alone paints the
default theme first and flips after hydration.

**A toggle for the wallet UI only**

```tsx
useEffect(() => {
  document.documentElement.dataset.zdMode = dark ? 'dark' : 'light'
}, [dark])
```

**Override tokens** from the host stylesheet, no build step:

```css
:root { --zd-text-brand-primary: #7c5cff; }
html[data-zd-mode="dark"] { --zd-bg-neutral-primary: #000; }
```

`tokens.css` carries a block per brand keyed on `data-zd-brand` and sets
the colour scheme per `data-zd-mode`, in `:where()` so any host rule beats
it. The scheme applies to the kit's own surfaces only, so a dark wallet on
a light page leaves the page's scrollbars and form controls alone. Custom
properties inherit, so the nearest ancestor that sets one wins. Put both
attributes on the same element: the dark blocks key on the pair. Tooltips
and dropdowns portal into a shared root under `document.body`, which
inherits from `<html>` like everything else; a theme set on a wrapper below
`<html>` reaches the frame but not its popovers, so set it on `<html>`.

The two light variants are carried today; a dark mode paints the light
values and keeps the light scheme until the dark values ship.

The compiled stylesheet ships every token utility, used by a component or
not, so an app without a Tailwind build can still write
`className="zd:bg-error-bold"`. The `@source inline` lines at the end of the
file do that; `tokens.test.ts` fails when they drift from the `@theme`
block. Only the bare classes ship; add a variant to the brace group there to
ship it too.

#### Changing the tokens

Everything lives in `src/theme/tokens.css`. After any change, run
`pnpm test -- src/theme` and `pnpm build:css`, then commit; nothing is
generated.

- **Change a value.** Edit the hex in the brand block(s). Values are
  lowercase `#rrggbb` or `#rrggbbaa`, copied from the Figma variable.
- **Add a token whose words already exist** (for example
  `bg-info-tertiary`). Add its alias to the `@theme inline` block under the
  right namespace (`--background-color-info-tertiary:
  var(--zd-bg-info-tertiary);`) and its value to every brand block. The test
  names whatever is missing.
- **Add a token with a new word** (for example `bg-info-muted`). As above,
  then add the word to the matching brace group of the `@source inline`
  line (the test names the utility until it is safelisted). Keep to words
  that are not Tailwind size or
  palette names (`sm`, `red`, `white`): the brace groups are multiplied
  out, and such a word could make a stray built-in utility ship.
- **Add a role.** Choose the Tailwind namespace that paints it for the alias
  (`--background-color-*`, `--text-color-*`, `--border-color-*`; icons use
  `--text-color-icon-*` because icons draw with `currentColor`), add it to
  `NAMESPACE` and `UTILITY` in `tokens.test.ts`, and to the first brace
  group of the `@source inline` line.
- **Rename or remove a token.** Edit or delete its alias and value lines.
  Search the packages for the old class before removing: nothing else
  records usages.
- **Ship a variant without a host build** (for example `hover:`). Add it to
  the first brace group of the `@source inline` line as `{,hover:}`; it
  then applies to every token.
- **Add a theme variant.** Add a block keyed on both attributes after the
  brand blocks, with its `--zd-color-scheme` and every token, plus the
  `system` twin under `prefers-color-scheme: dark`; list
  the variant in `SHIPPED_THEME_VARIANTS` in `tokens.test.ts` and give the
  test its declarations. Keep the `@theme` block `inline`, or Tailwind puts the
  alias on `:root` and the brand blocks stop reaching the utilities.

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
```
