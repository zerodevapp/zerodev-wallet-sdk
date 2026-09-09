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

The RPC URLs are optional but not free to skip: left blank, viem falls back to
each chain's public endpoint, which is rate-limited. Reconnecting on page load
builds the kernel account over RPC, so a throttled request turns into a long
"Reconnecting..." spinner (viem retries 3x with a 10s timeout). Use a provider
URL (Alchemy, Infura, dRPC, ...) for anything beyond a quick look.

## Running the Application

1. Start the development server:

```bash
pnpm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser
