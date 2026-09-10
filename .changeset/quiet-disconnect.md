---
'@zerodev/wallet-react-ui': patch
---

feat: `useDisconnect` — logout that can never surface a wallet prompt

Drop-in replacement for wagmi's `useDisconnect`. wagmi's injected connector
sends `wallet_revokePermissions` on disconnect; if the wallet still holds an
unanswered connection request for the origin (ignored prompt + reload —
pending confirmations live in the extension and survive reloads), the revoke
re-arms it and the wallet pops its connect view at logout. EIP-1193 offers no
way to clear a wallet's queue, so this hook suppresses the revoke: disconnect
stays app-side (wagmi state + reconnect shim), and the site remains
authorized in the wallet until the user revokes it there.
