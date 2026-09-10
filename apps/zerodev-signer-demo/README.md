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
NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL=
NEXT_PUBLIC_ZERODEV_PROJECT_ID=
```

The RPC URLs are optional but worth setting: left blank, viem falls back to
each chain's rate-limited public endpoint, and a throttled request during the
page-load reconnect turns into a long spinner (viem retries 3x with a 10s
timeout).

## Running the Application

1. Start the development server:

```bash
pnpm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser
