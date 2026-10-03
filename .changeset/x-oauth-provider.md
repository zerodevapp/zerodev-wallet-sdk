---
'@zerodev/wallet-core': minor
'@zerodev/wallet-react': minor
---

Add X as an OAuth provider.

`getOAuthLoginUrl` and `authenticateOAuth` / `useAuthenticateOAuth` accept
`provider: 'x'` alongside `'google'`. Requires a backend that serves
`GET oauth/x/login-url`. `@zerodev/wallet-core` exports the accepted list as
`OAUTH_PROVIDERS` and its union type as `OAuthProvider`; any other value is
rejected before a request is made.

New export `verifyOAuthLoginUrl(provider, loginUrl, publicKey)` checks the
login URL host against the provider's expected host and the `nonce` against
the session pubkey hash. `verifyGoogleLoginUrl` is still exported but
deprecated in favour of `verifyOAuthLoginUrl`.
