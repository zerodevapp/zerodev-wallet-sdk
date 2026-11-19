---
"@zerodev/wallet-core": patch
---

feat: email OTP and magic-link logins verify the code through the KMS (`POST /auth/verify/otp`) and log in with a stamp login in the user's sub-org, instead of verifying with the Turnkey Auth Proxy and logging in with `login/otp`. The verification token never reaches the client: the KMS keeps it and the session key's login stamp carries an alias of it. The `verifyOtp` and magic-link `verify` results of `auth()` now carry the user's registration (`subOrganizationId`, `userId`, `walletAddresses`) with the `session`. Needs a KMS whose Turnkey policy allows it to verify OTPs (DPL-950).
