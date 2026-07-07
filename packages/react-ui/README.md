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

## Development

```bash
pnpm build       # build the package (dist + types + css)
pnpm dev         # watch mode (types)
pnpm typecheck
pnpm test        # vitest
pnpm storybook   # component catalog
```
