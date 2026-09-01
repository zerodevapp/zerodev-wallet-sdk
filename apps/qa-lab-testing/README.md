# qa-lab-testing

The QA host app for the ZeroDev Wallet SDK — the surface used for **e2e (Playwright) and manual testing**.

Unlike `zerodev-signer-demo` (the customer-facing demo), this app exists purely for testing. It carries no
marketing content.

## Layout

Every feature we ship gets a surface here. Two levels of grouping:

- **Feature** — a product capability (Tx Signing, SRA). One sidebar entry, one route.
- **Area** — a slice of one feature's test surface (Signing, Contracts). One tab, one route.

```
┌──────────────────────────────────────────────────────────────────┐
│  ZeroDev  QA LAB                                  [ Environment ] │
├─────────────────┬────────────────────────────────────────────────┤
│ FEATURES        │  0x1234…abcd ⧉   0.4213 ETH ⟳   [Arb Sep ▾]    │
│  ▸ Tx Signing   │                        [Export] [Logout]        │
│    SRA          ├────────────────────────────────────────────────┤
│                 │  Tx Signing                    ⚠ in progress    │
│                 │  ┌ Signing │ Transactions │ Contracts │ RPC ┐   │
│                 │  │   test cases…                          │    │
└─────────────────┴────────────────────────────────────────────────┘
```

## Routes

| Route                  | Behaviour                                                   |
| ---------------------- | ----------------------------------------------------------- |
| `/`                    | Overview — every feature and its status. Auth gate: renders the `ConnectWallet` login when disconnected, swapping in place with no redirect. |
| `/tx-signing/<area>`   | A Tx Signing area: `signing`｜`transactions`｜`contracts`｜`rpc`｜`session`. Unknown area → 404. |
| `/tx-signing`          | Redirects to the first area.                                 |
| `/transaction-history` | Live stamped Data API request and pagination diagnostics.    |
| `/sra`                 | Placeholder until the SRA PR lands.                          |
| `/verify`              | Magic-link callback. Pushes to `/` once wagmi connects.      |
| `/environment`         | Diagnostics. Env-var checks (pass/fail, values never shown) plus the **effective** wallet config after URL overrides. Not auth-gated. |
| `/config`              | Builder for wallet-config URLs. Holds no wallet state; not auth-gated. |

**Deep-link in E2E.** Areas are addressable, so a spec goes straight to its
surface — `page.goto('/tx-signing/contracts')` — instead of clicking through a
path shared with every other spec.

## Configuring the wallet from the URL

The wagmi setup — backend hosts, chains, transports, auth methods — is overridable via
**query params**, on **every route**. No `.env` edit, no server restart.

Nothing is persisted. There's no localStorage and no cookie: the URL is the whole state.
A bad value can't stick around, and one test can't contaminate the next.

### Params

| Param | Values | Example |
| --- | --- | --- |
| `kms` | http(s) URL | `?kms=https://kms-local.test` |
| `aaHost` | http(s) URL | `?aaHost=https://aa-local.test` |
| `chains` | csv of chain ids (see below) | `?chains=1,42161` |
| `rpc.<chainId>` | http(s) URL | `?rpc.421614=https://my-rpc.test` |
| `authMethods` | csv of `email`｜`google`｜`passkey` | `?authMethods=email,passkey` |
| `emailAuth` | `otp`｜`magicLink` | `?emailAuth=magicLink` |

Anything absent falls back to the values in `lib/wallet-config.ts` — i.e. exactly what
the app runs with today. Combine freely:

```
/tx-signing/signing?chains=421614&emailAuth=magicLink&authMethods=email,passkey
```

### Chains

| Chain | id | Selected by default |
| --- | --- | --- |
| Arbitrum Sepolia | `421614` | yes |
| Sepolia | `11155111` | yes |
| Arbitrum One | `42161` | no |
| Ethereum | `1` | no |
| Anvil | `31337` | no |

`?chains=` replaces the selection entirely — `?chains=31337` runs Anvil only. Nothing
stops you picking a chain the ZeroDev project doesn't support; it fails at runtime rather
than being rejected up front, because the SDK has no whitelist to check against.

### Transports

Resolved per selected chain, first match wins:

1. **`rpc.<chainId>` param** — hand-written, not exposed in the builder.
2. **Env var** — only `NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL` and `NEXT_PUBLIC_SEPOLIA_RPC_URL` exist.
3. **Default** — `https://staging-rpc.zerodev.app/api/v3/<PROJECT_ID>/chain/<CHAIN_ID>`,
   built from `NEXT_PUBLIC_ZD_PROJECT_ID`. **Anvil instead gets
   `http://localhost:18545`**, since it's a local node.
4. **Chain default** — viem's public RPC, reached only when the project id is unset.

`/environment` shows which of these each chain landed on (`from URL`, `from env`,
`zerodev staging`, `local node`, `chain default`), never the URL itself.

**Invalid values never fail silently.** A bad URL, unknown chain id, or unknown auth
method falls back to the default *and* raises a warning on `/environment`. Without that,
a spec with a typo'd param would run against defaults while looking like it tested an
override.

Two guards, enforced in the parser and not just the form, because URLs get hand-edited:
at least one chain (wagmi types it as a non-empty tuple) and at least one auth method
(otherwise there's no way to sign in).

### Changing the defaults

URL params only affect the tab you're in — they're per-session and per-test, and they
never change what the app does by default. To change what everyone gets with a bare URL,
edit the source of that default:

| What | Where | Notes |
| --- | --- | --- |
| Chains selected by default | `src/app/lib/wallet-config.ts` → `SUPPORTED_CHAINS` | |
| Which chains are *selectable* | `src/app/lib/wallet-config.ts` → `CHAIN_CATALOG` | add a `viem/chains` import; it appears in `/config` and becomes valid in `?chains=` automatically |
| Auth methods | `src/app/lib/wallet-config.ts` → `DEFAULT_AUTH_METHODS` | only `email`｜`google`｜`passkey` exist |
| Email auth method | `src/app/lib/wallet-config.ts` → `DEFAULT_EMAIL_AUTH_METHOD` | `otp`｜`magicLink` |
| Default transport template | `src/app/lib/wallet-config.ts` → `ZERODEV_STAGING_RPC_BASE` | used for every chain except Anvil |
| Anvil's RPC | `src/app/lib/wallet-config.ts` → `ANVIL_RPC_URL` | |
| KMS proxy base URL | `.env` → `NEXT_PUBLIC_KMS_PROXY_BASE_URL` | |
| AA host | `.env` → `NEXT_PUBLIC_ZERODEV_AA_HOST` | |
| Data API origin | `.env` → `NEXT_PUBLIC_DATA_API_BASE_URL` | Env-only; intentionally not URL-overridable. |
| Project id | `.env` → `NEXT_PUBLIC_ZD_PROJECT_ID` / `NEXT_PUBLIC_ZD_OTP_PROJECT_ID` | also feeds the default transport URL |
| Arb-Sepolia / Sepolia RPC | `.env` → `NEXT_PUBLIC_ARB_SEPOLIA_RPC_URL`, `NEXT_PUBLIC_SEPOLIA_RPC_URL` | these win over the default template |

**`.env` changes need a dev-server restart** — Next inlines `NEXT_PUBLIC_*` at build time.
Changes to `wallet-config.ts` hot-reload like any other source file.

### Trying stamped transaction history locally

The QA Lab and Data API both default to port `3000`, so run the API on `3001`.
Its `apps/api/.env` still needs a valid `ZERION_API_KEY`:

```sh
cd ../zerodev-data-api
PORT=3001 pnpm --filter @zerodev/data-api dev
```

Point the QA Lab connector at that origin in
`apps/qa-lab-testing/.env.local`:

```sh
NEXT_PUBLIC_DATA_API_BASE_URL=http://127.0.0.1:3001
```

Then restart the lab and open `/transaction-history` after logging in:

```sh
cd ../zerodev-wallet-sdk
pnpm --filter @zerodev/qa-lab-testing dev
```

The page imports `useTransactionHistory` from the optional
`@zerodev/wallet-data` package and passes the configured URL directly to the
hook. A successful empty page still proves that the request stamp was accepted.
Use the mainnet/testnet toggle to change the explicitly signed environment, and
use the browser Network panel to inspect `X-Wallet-Address`, `X-Timestamp`,
`X-Stamp`, and `X-Env`.

Because everything else derives from `wallet-config.ts`, editing a default there updates
the app, the `/config` builder and the `/environment` readout together — there is no
second place to keep in sync.

### Building a URL

`/config` is a form that generates one — pick a config, choose a target route, copy the
URL. It holds no wallet state; it just turns choices into a query string. Reachable from
the **Config** button in the header, or from **Change configuration** on `/environment`.

The URL it emits is exactly what a Playwright spec would use, so the workflow is: build
it by hand once, copy, paste into the test.

### Using it in E2E

```ts
await page.goto('/tx-signing/signing?emailAuth=magicLink')
```

One dev server covers every permutation, each spec states its own config, and nothing
leaks between tests — which is the main reason this exists.

### Two things to know

**Changing config signs you out.** A different config means a new wagmi connector, and a
new connector means a new session. That's inherent to wagmi. It's why applying a config
does a full page load rather than a client-side navigation.

**Internal links must use `ConfigLink`, never `next/link`.** A plain link drops the query
string, which silently reverts the config to defaults *and* logs you out — the page still
looks right, it's just no longer running what you asked for. `eslint no-restricted-imports`
makes importing `next/link` a build error everywhere except `ConfigLink` itself, so this
can't be reintroduced by accident. For non-link navigation (`window.location.assign`),
use `useConfigHref()`.

The header shows a **`config overridden · N`** badge whenever params are active. If it
disappears mid-session, something dropped them.

### Where it lives

| File | Role |
| --- | --- |
| `lib/wallet-config.ts` | `DEFAULT_*` — the fallbacks |
| `lib/config-params.ts` | schema, parse, validate, resolve, serialise |
| `lib/use-wallet-config.ts` | `useResolvedConfig()`, `useConfigHref()` |
| `components/ConfigLink.tsx` | link that forwards params |
| `providers.tsx` | builds the wagmi config from the resolved params |
| `config/page.tsx` | the URL builder |

`layout.tsx` forces dynamic rendering for every route. `useSearchParams()` returns empty
during a static render, so the server would build a default config while the client built
an overridden one and any chain-derived UI would mismatch on hydration.

## Adding a feature

1. Add an entry to `src/app/lib/features.ts` (id, name, description, status, areas).
2. Add a page under `src/app/(lab)/<id>/`.

Sidebar, overview card, tabs, routes and test IDs all derive from that entry, so
there's no second place to update. The auth gate lives in `(lab)/layout.tsx`, so
a new page can't ship ungated.

### Shell test IDs

| Test ID | Element |
| --- | --- |
| `lab-sidebar` / `nav-feature-<ID>` | Feature nav; `data-active="true"｜"false"` |
| `lab-main` | Content column |
| `overview` / `overview-feature-<ID>` | Overview page and its cards |
| `feature-<ID>-header` / `feature-<ID>-tabs` | Feature title block and tab bar |
| `feature-<ID>-tab-<AREA>` | One area tab; `data-active` |
| `area-<AREA>` | The rendered test-case stack |
| `status-<STATUS>` | Status chip: `ready`｜`wip`｜`planned` |
| `wallet-strip` | Shared wallet bar |
| `wallet-address` / `wallet-copy-address` / `wallet-explorer-link` | Address controls |
| `wallet-balance` / `wallet-asset-<ETH\|USDC>` / `wallet-refresh-balance` | Balance controls; asset buttons carry `data-selected` |
| `wallet-export-keys` / `wallet-logout` | Wallet actions |
| `sra-placeholder` | SRA holding message |

### `/environment` test IDs

Server-rendered per request, so it reflects the environment the server is
actually running with — not what was inlined at build time.

| Test ID | Element |
| --- | --- |
| `header-home-link` | Logo link back to `/` |
| `header-environment-link` | Header button into `/environment` |
| `env-back-to-lab` | Back link to `/` |
| `env-checks-card` / `env-checks-heading` | Environment checks card |
| `env-table` | The checks table |
| `env-row-<VARIABLE>` | One row, e.g. `env-row-NEXT_PUBLIC_ZERODEV_AA_HOST` |
| `env-<VARIABLE>` | That row's result pill; `data-pass="true"｜"false"` |
| `env-config-card` / `env-config-heading` | Wallet configuration card |
| `env-config-row-<ID>` | A config row, `<ID>` = `chains`｜`transports`｜`auth-methods` |
| `env-config-label-<ID>` | That row's label cell |
| `env-chains` | Chain chips container |
| `env-chain-<CHAIN_ID>` | One chain chip, e.g. `env-chain-421614` |
| `env-transports` | Transport chips container |
| `env-transport-<CHAIN_ID>` | One transport chip; `data-explicit="true"｜"false"` |
| `env-auth-methods` | Auth method chips container |
| `env-auth-method-<METHOD>` | One method chip, e.g. `env-auth-method-passkey` |

Each pill also carries `data-pass="true"|"false"`, so assert on that rather than
the label — the label wording differs per check type (`true`/`false` for
"is set", `staging`/`not staging` for the URL checks).

```ts
await expect(page.getByTestId('env-NEXT_PUBLIC_KMS_PROXY_BASE_URL'))
  .toHaveAttribute('data-pass', 'true')
```

## QA Lab

`src/app/components/testing-lab/` holds the test cases, grouped into five tabs:

- **Signing** — message counter, preset messages, invalid typed data
- **Transactions** — send ETH, high amount, invalid address
- **Contracts** — balances, ERC-20, ERC-721, hello-world
- **RPC** — read methods, `wallet_watchAsset`, chain methods
- **Session** — session expiry

Each test case is self-contained: its own explanation, controls, and inline results. Adding one means
dropping a component into `testing-lab/` and listing it in the relevant tab in `TestingLab.tsx`.

## Running it

```bash
pnpm install                                  # from the repo root
cp .env.example .env                          # then fill in the values
pnpm --filter @zerodev/qa-lab-testing dev     # http://localhost:3000
```

Port **3000** because the ZeroDev project's access-control policy only permits
`http://localhost:3000` as an origin — anything else gets a 403 from the KMS backend.
`zerodev-signer-demo` defaults to the same port, so pass an explicit `--port` to whichever
you start second.

## e2e

`e2e/playwright.config.ts` boots this app and the Playwright suite runs against it. Two things
to know when writing specs:

- There is no post-login route. The auth gate swaps the login surface for the lab at the same
  URL, so wait on the lab (`expectLabReady` in `e2e/helpers/ui-login.ts`), not a navigation.
- Wallet config comes from URL params, not localStorage. A spec picks a non-default by
  navigating — e.g. `goto('/?emailAuth=magicLink')` — and every later navigation in that test
  must carry the same params, or the wagmi connector is rebuilt and the session is lost.
