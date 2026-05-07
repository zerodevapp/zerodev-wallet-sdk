---
"@zerodev/wallet-core": patch
"@zerodev/wallet-react": patch
---

fix(react): switch OAuth flow to fetch + verify the Google login URL client-side (audit finding TOB-KMS-1).

The SDK now calls `GET /oauth/google/login-url` to fetch the Google OAuth authorization URL, verifies the URL host is `accounts.google.com` and that its `nonce` query parameter equals `sha256(utf8_bytes_of(pub_key_hex))`, and only then opens the popup. A malicious or compromised backend can no longer substitute its own session pubkey at the Turnkey OIDC step.

Requires backend on `afilios/dpl-477-implement-login-url-endpoint` or later. No public API change to `authenticateOAuth` / `useAuthenticateOAuth`. Removed exports: `buildBackendOAuthUrl`. Added exports: `fetchGoogleLoginUrl`, `verifyGoogleLoginUrl`, `generateOAuthNonce` (encoding fixed to match backend).
