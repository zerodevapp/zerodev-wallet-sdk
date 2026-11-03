# solana-qa-demo

A manual QA harness for the Solana external-wallet support in
`@zerodev/wallet-react-ui`. Three buttons, no social logins, no dashboard.
Port 3003.

It exists because the signer demo's playground is too big to reason about when
the question is "what exactly does the kit report right now". Here the whole
state the kit exposes is on screen, and nothing else is.

## Setup

```bash
cp .env.example .env.local     # then port the values from apps/zerodev-signer-demo
mise exec -- pnpm --filter @zerodev/solana-qa-demo dev
```

Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` no WalletConnect connector
registers, so `kit.solana.walletConnect` reads false and the Solana
WalletConnect row hides itself. Installed wallets still work, which makes the
unset case worth testing on purpose.

Use `hot-dev` instead of `dev` to rebuild `wallet-react-ui` on change, since
the app consumes its built `dist` rather than its source.

## The two routes

Both share one wagmi config, and that config has `solana: true`. Enabling the
door is a config-level choice an app makes once. What the routes differ in is
how they read and drive the connection, which is the thing worth testing.

**`/with-solana`** reads `useZeroDevWalletKit()`, opens the sheet with
`kit.connect({ namespace: 'solana' })`, signs through `useSolanaWallet()`, and
logs out with `kit.disconnect()`. It prints both namespaces and the aggregate,
plus which of the three signing methods the connected account actually exposes.

**`/without-solana`** is the control, wired the way an app was before Solana
existed: `useAccount()`, `useDisconnect()`, `useSignMessage()`, and an EVM-only
sign-up.

Connect a Solana wallet on the first route, then open the second. It will say
`disconnected`. That is not a bug in either page, it is the integration hazard:
a Solana sign-in never flips `useAccount()`, so an app that adds Solana and
keeps gating on it shows a signed-in user a login screen. The same goes for
`useDisconnect()`, which leaves the Solana session connected and, on a wallet
serving both sides, sends the permission revoke that `detachEvmConnection`
exists to avoid.

## Why two routes rather than two panels on one page

`auth.step` in the kit store is single-valued, and `openSolanaSignUp` rejects
with `Auth flow already in progress` when a flow is already open. Two sign-up
sheets mounted at once would fight over it, and the resulting failure would
look like a bug in the feature rather than in the harness.

## What this is not

Not an automated test. Nothing here runs in CI, and it asserts nothing. It is
the thing you drive by hand while writing test cases and while executing them.
