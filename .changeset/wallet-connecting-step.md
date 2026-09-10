---
'@zerodev/wallet-react-ui': patch
'@zerodev/wallet-react': patch
---

fix: external wallet connection no longer freezes the sign-up page

Picking an external wallet now moves to a `wallet-connecting` step instead of
disabling the sign-up page while wagmi's `connect()` is pending. A locked
wallet, or a popup closed without answering, never answers; the new step shows
which wallet it is waiting on and always offers a way back.

- Outcomes are reported for what they are: "Request declined" on rejection;
  MetaMask's `-32002` (popup closed, then clicked again) shows as "Request
  waiting in MetaMask" with instructions to finish it in the extension. Raw
  JSON-RPC error objects no longer render as `[object Object]`.
- The connection is detected from wagmi's store, so it works even when the
  host redirects and unmounts the widget in the same render. A late approval
  after leaving the screen still closes the widget; a late rejection from a
  wallet the user walked away from is ignored.
- Re-picking a wallet with an open request re-adopts it instead of sending
  another `connect()` (wallets queue requests; leftovers resurface as ghost
  prompts). A wallet wagmi already restored closes the flow instead of
  throwing `ConnectorAlreadyConnectedError`. During wagmi's page-load
  reconnect, `connect()` is held until the sweep settles.
- `goToStep(null)` clears the step history, fixing the stray back arrow after
  connect → disconnect.
- New export `useDisconnect`: wagmi's hook minus the wallet prompt. The
  injected connector's `wallet_revokePermissions` re-arms any unanswered
  request in the extension and pops it at logout; this suppresses the revoke,
  so the site stays authorized in the wallet until the user revokes it there.

`@zerodev/wallet-react`: the `zeroDevWallet` connector logs timing for
initialization, connect, and per-chain kernel account setup, with the chain
id. RPC URLs are never logged.
