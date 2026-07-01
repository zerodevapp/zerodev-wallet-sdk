# ZeroDev Wallet Demo

An interactive demo of the ZeroDev embedded wallet: any sign-in (passkey, email,
or Google) becomes a self-custodial smart account — no seed phrases, no browser
extensions, and gas can be sponsored so users never need native ETH.

The landing page shows the auth experience two ways — the prebuilt `AuthFlow`
component and a white-label build — and the authenticated "Wallet playground"
walks through real flows on **Arbitrum Sepolia**:

- **Mint without gas** — mint an NFT with sponsored gas, even with an empty wallet.
- **Use stables without gas** — convert USDC → ETH, sponsored and batched behind one signature.
- **Delegate a budget** — grant a scoped, rate-limited session key (`@zerodev/permissions`) that drips USDC to allow-listed wallets, with limits enforced on-chain and revocable at any time.
- **Sign anything** — personal sign, EIP-712 typed data, and signing to send USDC or native ETH.
- **Own and export keys** — prove the wallet is user-owned by exporting the seed phrase or private key.

## Stack

Next.js (App Router) · wagmi/viem · `@zerodev/wallet-react` + `@zerodev/wallet-react-kit` · Kernel v3 smart accounts (EntryPoint 0.7, EIP-7702).

## Prerequisites

- [Node.js](https://nodejs.org) v18+ and [pnpm](https://pnpm.io/)
- A [ZeroDev](https://dashboard.zerodev.app) project ID (for the sponsored bundler/paymaster)

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in the values below
```

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ZERODEV_PROJECT_ID=   # from the ZeroDev dashboard
NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL=  # Arbitrum Sepolia RPC (primary chain)
NEXT_PUBLIC_SEPOLIA_RPC_URL=      # optional
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL= # optional
```

## Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).
