# Running the signer-demo against a local Anvil node (local AA)

How to run `apps/zerodev-signer-demo` against a **local Anvil** node with the full
ERC-4337 / EIP-7702 account-abstraction path working end-to-end — no live testnets, no
hosted ZeroDev bundler.

> **Branch:** this work lives on `cferreira/local-node-investigation`. It's an
> investigation of what a local node needs; committed but not yet PR'd.

Verified working: a 7702 UserOperation sent from the demo, bundled by the local Ultra
Relay, executed by EntryPoint v0.7 on the local Anvil (tx `0x4a67…7f82`, status `0x1`).

## Why it isn't just "point at localhost"

The wallet is an ERC-4337 smart account. A local chain gives you *contracts*, but AA also
needs a **bundler** (an off-chain service that calls `EntryPoint.handleOps`) and the
correct **Kernel v3.3** contracts on-chain. The SDK is hardwired to `KERNEL_V3_3` +
EntryPoint v0.7 (see `packages/react/src/core/connector.ts`), and its default mode is
EIP-7702. See the companion notes for the deep dive (Obsidian: *Kernel v2 vs v3*, *Anvil +
AA Local — Working Recipe*).

## The pipeline

```
Browser (signer-demo, 7702/4337, Kernel v3.3)
  → /api/local-bundler        Next same-origin proxy (kills CORS; maps zd_* → pimlico_*)
  → Ultra Relay bundler       zerodev-stack docker, :18080
  → EntryPoint v0.7           local Anvil 31337, :18545
  → mined ✓                   (self-funded account, no paymaster)
```

## Prerequisites

1. **The `zerodev-stack` docker backend, running** (separate repo, `~/Developer/zerodev-stack`):
   ```bash
   cd zerodev-stack/e2e-testing && make dev      # anvil :18545, Ultra Relay bundler :18080, redis, postgres
   ```
   The stack's deployer must include the **Kernel v3.3** contracts (added on the stack
   side). Verify with the commands under [Verifying the chain](#verifying-the-chain). If
   your stack build predates that, use the [fallback scripts](#fallback--legacy-scripts).
   The provider gateway (`:13000`) is **not** needed for this path.
2. **Foundry** (`cast`, `anvil`) — for funding and the standalone/snapshot fallback.
3. **Rebuild `@zerodev/wallet-react`.** `packages/react/dist` is **gitignored** and the app
   consumes `dist` (not `src`), so after checking out this branch:
   ```bash
   pnpm install
   pnpm --filter @zerodev/wallet-react build
   ```
   Without this, the `aaOverrides` support won't exist in the dist the app loads.

## What changed in this repo

| File | Change |
|---|---|
| `packages/react/src/core/connector.ts` | Added a per-chain `aaOverrides` param (`{ bundlerUrl, selfFunded }`): use a bare bundler URL instead of `getAAUrl`, and omit the paymaster when self-funded. Opt-in; hosted path untouched. |
| `apps/zerodev-signer-demo/src/app/wagmi-config.tsx` | Registered chain **31337** (wagmi's `anvil`) in `chains`/`transports`/`rpcUrls`; set `aaOverrides[31337]` → the local-bundler proxy, `selfFunded: true`. |
| `apps/zerodev-signer-demo/src/app/api/local-bundler/route.ts` | New same-origin proxy to the docker bundler (`:18080`): dodges browser CORS and translates the SDK's `zd_getUserOperationGasPrice` → `pimlico_getUserOperationGasPrice`. |

## Setup & run

```bash
# 1. Stack up (in zerodev-stack)
cd ~/Developer/zerodev-stack/e2e-testing && make dev

# 2. Build the SDK package (dist is gitignored)
cd ~/Developer/zerodev-wallet-sdk
pnpm install && pnpm --filter @zerodev/wallet-react build

# 3. Configure the app env (apps/zerodev-signer-demo/.env.local)
#    see Environment variables below

# 4. Run the app
pnpm --filter @zerodev/signer-demo dev      # http://localhost:3000

# 5. Log in, then fund the account the dashboard shows (restart wipes balances)
cast rpc anvil_setBalance <account-address> $(cast to-wei 10 ether) --rpc-url http://localhost:18545

# 6. Switch the network to "Anvil (local)" and send a transaction
```

## Environment variables

`apps/zerodev-signer-demo/.env.local`:

| Var | Value | Needed for |
|---|---|---|
| `NEXT_PUBLIC_WALLET_MODE` | `7702` (default) or `4337` | selecting the account mode |
| `NEXT_PUBLIC_ANVIL_RPC_URL` | `http://localhost:18545` | read transport (falls back to this if unset) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | builds the same-origin proxy URL in `aaOverrides` |
| `NEXT_PUBLIC_ZERODEV_PROJECT_ID` | any valid UUID | required connector param (not used in the bundler URL under the override) |

The AA bundler URL for 31337 is **not** an env var — it's the `aaOverrides` entry in
`wagmi-config.tsx`, pointing at `${NEXT_PUBLIC_APP_URL}/api/local-bundler`.

## Modes: 7702 vs 4337

- **7702** (default): the EOA delegates to the Kernel v3.3 impl. No factory needed. Fund
  the EOA (the account address == the EOA address).
- **4337**: a counterfactual Kernel account, deployed via the factory on first UserOp.
  Needs the factory + metaFactory (with `approveFactory` done) + the `≥0.3.1` ECDSA
  validator on-chain. Fund the **counterfactual** address the dashboard shows.

In both modes the paymaster is skipped (`selfFunded`), so the account pays its own gas —
hence the funding step.

## On-chain requirements (Kernel v3.3)

The chain must have these (the stack deployer provides them; addresses are canonical):

| Contract | Address |
|---|---|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| Kernel v3.3 impl / 7702 delegation | `0xd6CEDDe84be40893d153Be9d467CD6aD37875b28` |
| Kernel v3.3 factory | `0x2577507b78c2008Ff367261CB6285d44ba5eF2E9` |
| MetaFactory (FactoryStaker) | `0xd703aaE79538628d27099B8c4f621bE4CCd142d5` |
| OnlyEntryPoint hook | `0xb230f0A1C7C95fa11001647383c8C7a8F316b900` |
| ECDSA validator (`≥0.3.1`, for 4337) | `0x845ADb2C711129d4f3966735eD98a9F09fC4cE57` |

### Verifying the chain

```bash
# each should return long bytecode, not "0x"
for a in 0x0000000071727De22E5E9d8BAf0edAc6f37da032 \
         0xd6CEDDe84be40893d153Be9d467CD6aD37875b28 \
         0x2577507b78c2008Ff367261CB6285d44ba5eF2E9 \
         0xd703aaE79538628d27099B8c4f621bE4CCd142d5 \
         0xb230f0A1C7C95fa11001647383c8C7a8F316b900 \
         0x845ADb2C711129d4f3966735eD98a9F09fC4cE57; do
  echo "$a -> $(cast code $a --rpc-url http://localhost:18545 | head -c 12)"
done
# factory wired to the impl:
cast call 0x2577507b78c2008Ff367261CB6285d44ba5eF2E9 "implementation()(address)" --rpc-url http://localhost:18545
```

## Persistence across restarts

Anvil state is **in-memory**. On a stack restart the deployer redeploys contracts, but
**account balances are wiped** — so re-fund with `anvil_setBalance` after each restart
(the only recurring manual step). Contracts come back from the deployer; no set-code
needed.

## Fallback / legacy scripts

These were the pre-deployer workaround (`anvil_setCode` etch). Keep them for a stack build
without the v3.3 deployer change, or for a fully standalone node:

| Script | Use |
|---|---|
| `seed-kernel-v33.sh` | `anvil_setCode` the v3.3 impl + hook from Arb Sepolia (7702-only; no factory) |
| `capture-state.sh` | Snapshot a known-good node → `anvil-state.json` |
| `restore-docker.sh` | `anvil_loadState` the snapshot into the running docker anvil (restores contracts **and** funding) |
| `start-standalone.sh` | Boot a standalone anvil preloaded from `anvil-state.json` (no docker/deployer; needs a bundler pointed at it) |
| `anvil-state.json` | Committed snapshot (plain `SerializableState` JSON) |

**Format note:** `anvil --state`/`--load-state` (CLI) read plain JSON; `anvil_dumpState`/
`anvil_loadState` (RPC) use gzip-hex — the scripts convert only where forced.

## Known gotchas

- **Raw bundler from the browser fails twice** — CORS + the `zd_*` dialect. Always go
  through `/api/local-bundler`, never point the SDK straight at `:18080`.
- **The staging dashboard URL is a dead-end for local** — that cloud bundler is bound to
  ZeroDev's own 31337 node; it can't see your local chain, and you can't repoint its RPC.
- **`reason: 0x` on a value transfer = insufficient balance** (no pre-flight check) —
  fund more.
- **Rebuild the SDK after pulling** — `dist` is gitignored (see prerequisites).

## Still open / not done

- The persistence scripts are a stopgap. Cleaner: launch anvil with `--state
  anvil-state.json` (auto load+dump), or add `--state` + a volume to the stack's compose.
- End-to-end **4337** run through the bundler still to be confirmed on the fresh stack
  (7702 is verified). That's the check that exercises the metaFactory approval + validator
  install.
