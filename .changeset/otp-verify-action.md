---
"@zerodev/wallet-core": patch
---

feat: `verifyOTP` action, which verifies an OTP through the KMS (`POST /auth/verify/otp`) and returns the user's registration with an alias of the verification token. `loginWithStamp` takes an optional `sessionToken` (the alias, carried by the stamp) and `stamper` override, and now sends `organizationId` in the request body as well as signing it. The SDK's email login keeps using the Auth Proxy until the next release; the new route needs the KMS policy rollout (DPL-950) before it works.
