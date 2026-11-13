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

`src/theme/tokens.css` declares every themed colour in a Tailwind `@theme`
block, one variable per token, mirroring the "ZeroDev Design System" Figma
collection (light/dark × branded/plain; only the branded light default is
stated today). Tailwind's colour namespaces turn each variable into a
utility, so a component writes `zd:bg-neutral-primary`,
`zd:text-neutral-secondary`, `zd:text-icon-brand-primary` or
`zd:border-neutral-primary` and never a value. Opacity modifiers
(`zd:bg-neutral-primary/50`) and variants (`zd:hover:bg-error-bold`) work as
for any colour. The variables land on `:root` as
`--zd-background-color-<token>`, `--zd-text-color-<token>` and
`--zd-border-color-<token>`; a host restyles the UI by overriding them from
its own stylesheet.

The compiled stylesheet ships every token utility, used by a component or
not, so an app without a Tailwind build can still write
`className="zd:bg-error-bold"`. The `@source inline` lines at the end of the
file do that; `tokens.test.ts` fails when they drift from the `@theme`
block. Only the bare classes ship; add a variant to the brace group there to
ship it too.

#### Changing the tokens

Everything lives in `src/theme/tokens.css`. After any change, run
`pnpm test -- src/theme` and `pnpm build:css`, then commit; there is no
generator and nothing else to regenerate.

- **Change a value.** Edit the hex in the `@theme` block. Values are
  lowercase `#rrggbb` or `#rrggbbaa`, copied from the Figma variable.
- **Add a token whose words already exist** (for example
  `bg-info-tertiary`). Add one line to the `@theme` block under the right
  namespace: `--background-color-info-tertiary: #...;`. Done; the
  `@source inline` line already covers it.
- **Add a token with a new word** (for example `bg-info-muted`). Add the
  `@theme` line, then add the word to the matching brace group of the
  `@source inline` line (`muted` goes in the third group). The test fails
  and names the class until you do. Keep to words that are not Tailwind
  size or palette names (`sm`, `red`, `white`): the brace groups are
  multiplied out, and such a word could make a stray built-in utility ship.
- **Add a role.** Choose the Tailwind namespace that paints it
  (`--background-color-*`, `--text-color-*`, `--border-color-*`; icons use
  `--text-color-icon-*` because icons draw with `currentColor`), add its
  utility prefix to the first brace group, and add the namespace to the
  regexes in `tokens.test.ts` and `Tokens.stories.tsx`.
- **Rename or remove a token.** Edit or delete the `@theme` line. Search the
  packages for the old class before removing: nothing else records usages.
- **Ship a variant without a host build** (for example `hover:`). Add it to
  the first brace group as `{,hover:}`; it then applies to every token.
- **Add a theme variant** (dark, plain). Below the `@theme` block, add a rule
  that overrides the same variables on a scope, using their prefixed names:

  ```css
  .zd-scope[data-zd-theme="dark"] {
    --zd-background-color-neutral-primary: #130e0bcc;
    --zd-text-color-neutral-primary: #f7f5f0;
  }
  ```

  Keep the `@theme` block plain (not `@theme inline`), or the utilities
  inline the default value and the override has no effect.

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
```
