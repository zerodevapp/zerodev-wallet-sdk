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

### Earn tab

The Earn tab deposits into mainnet yield vaults through the hosted
[Earn API](https://docs.zerodev.app/onramp/earn) (`@zerodev/earn`). It needs:

- A ZeroDev project allowlisted for Earn whose origin allowlist includes the host you run on
  (`localhost:3000` for local dev). It defaults to `NEXT_PUBLIC_ZERODEV_PROJECT_ID`; set
  `NEXT_PUBLIC_EARN_PROJECT_ID` to use a different project.
- Optional `NEXT_PUBLIC_ARBITRUM_RPC_URL` / `NEXT_PUBLIC_BASE_RPC_URL`, since the tab adds Arbitrum
  One and Base to the wagmi config next to the testnets.
- Optional `NEXT_PUBLIC_EARN_SERVER_URL` to point at a self-hosted or staging Earn server.

Deposits are real mainnet transactions. Every deposit funds a Smart Routing Address; the tab keeps a
local deposit history so the SRA stays recoverable if a deposit is interrupted.

## Running the Application

1. Start the development server:

```bash
pnpm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser
