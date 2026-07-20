# ZeroDev Wallet Demo

## Prerequisites

- [Node.js](https://nodejs.org) v18+
- [pnpm](https://pnpm.io/)

For gasless transactions (EIP-7702), you'll also need a [ZeroDev](https://dashboard.zerodev.app) account to get a bundler RPC URL.

## Installation

1. Clone the repository and install dependencies:

```bash
pnpm install
```

## Environment Configuration

1. Copy the environment example file:

```bash
cp .env.example .env
```

2. Edit `.env` and fill in the required credentials:

```
NEXT_PUBLIC_SEPOLIA_RPC_URL=
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=
NEXT_PUBLIC_ZERODEV_PROJECT_ID=
```

## Running the Application

1. Start the development server:

```bash
pnpm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Running against a local Anvil node

To develop/QA against a **local Anvil** node (chain 31337) with the full ERC-4337 /
EIP-7702 account-abstraction path — no live testnets, no hosted bundler — see
[`local-aa/README.md`](../../local-aa/README.md) at the repo root. It covers the
`zerodev-stack` docker backend, the required Kernel v3.3 contracts, the `aaOverrides` +
same-origin bundler proxy wiring, funding, and the 7702/4337 modes.

Quick version: start the `zerodev-stack` docker backend, rebuild `@zerodev/wallet-react`
(its `dist` is gitignored), set `NEXT_PUBLIC_WALLET_MODE` + `NEXT_PUBLIC_ANVIL_RPC_URL`
in `.env.local`, run the app, switch the network to "Anvil (local)", and fund the account
with `anvil_setBalance`.
