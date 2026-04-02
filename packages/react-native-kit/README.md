# @zerodev/wallet-react-native-kit

React Native UI components for ZeroDev Wallet SDK.

## Overview

This package provides pre-built React Native UI components styled with [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for React Native). Components use the `className` prop for styling, which requires NativeWind to be configured in the consuming app.

## Installation

```bash
pnpm add @zerodev/wallet-react-native-kit
```

### Peer Dependencies

- `react` (^18.0.0 || ^19.0.0)
- `react-native` (>=0.73.0)
- [NativeWind](https://www.nativewind.dev/) configured in your project for `className` support

## Components

### Button

A styled pressable button with action variants.

```tsx
import { Button } from '@zerodev/wallet-react-native-kit'

<Button text="Connect Wallet" action="primary" />
<Button text="Cancel" action="secondary" />
<Button text="Settings" action="secondaryNeutral" />
<Button text="Unavailable" action="primary" disabled />
```

## Development


### Testing

Tests run via vitest with `react-native-web` aliasing:

```bash
pnpm test
```

