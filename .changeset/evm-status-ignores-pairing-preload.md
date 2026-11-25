---
"@zerodev/wallet-react-ui": patch
---

`useZeroDevWalletKit().eip155.status` no longer reads `connecting` for minutes after the sign-up sheet closes without an EVM connection. The sheet preloads a WalletConnect pairing so a QR is ready, and wagmi reports that pending connect as `connecting` until a scan or the proposal's expiry; a host that connected a Solana wallet only, or just closed the sheet, read the EVM side as connecting all that while. With the sheet closed and no connect of the kit's own running, a pending preload now reads as `disconnected`.
