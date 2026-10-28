# ZeroDev Smart Routing Address Demo

A playground for the `@zerodev/smart-routing-address-react-ui` widget. Runs
in two modes:

- **Simulated** — every SRA server call is intercepted by an
  in-memory mock, so you can exercise the full deposit lifecycle (routing,
  fees, past deposits, error states) without any real network, funds, or
  project ID. The banner and controls make this mode explicit.
- **Mainnet** — the widget speaks to the live
  SRA server. Real deposit addresses, real routing, real funds. The mode
  toggle is persisted in `localStorage` and the recipient is cleared as a
  safety default so you can't accidentally send funds to a stale address.

## Prerequisites

- [Node.js](https://nodejs.org): the version in the repo root `.nvmrc` (see [CONTRIBUTING.md](../../CONTRIBUTING.md))
- [pnpm](https://pnpm.io/)

The Vercel project for this app pins its Node major in the project settings
(Node.js Version, currently 24.x), not in the repo. Do not add `engines` to
this app's `package.json`: pnpm checks every workspace project's `engines`
during the root install, and Vercel would auto-select the newest major that
matches the range rather than the one CI runs.

You'll need a [ZeroDev](https://dashboard.zerodev.app) account for a project
ID if you plan to use Mainnet mode.

## Installation

From the repo root:

```bash
pnpm install
```

## Environment Configuration

1. Copy the environment example file (if present) or create `.env`:

```bash
cp .env.example .env
```

2. Fill in the required values:

```
NEXT_PUBLIC_ZERODEV_PROJECT_ID=
```

## Running the Application

1. Start the development server:

```bash
pnpm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser.
