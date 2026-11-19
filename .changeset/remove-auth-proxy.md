---
"@zerodev/wallet-core": patch
---

refactor: remove the Turnkey Auth Proxy client and the legacy OTP login, which the KMS `verify/otp` route replaced. Removed from the package root and the `./actions` entry point: `loginWithOTP`, `LoginWithOTPParameters`, `LoginWithOTPReturnType`, `getAuthProxyConfigId` and `GetAuthProxyConfigIdReturnType`; removed from `ZeroDevWalletActions`: `loginWithOTP` and `getAuthProxyConfigId`. `createAuthProxyClient`, `buildClientSignature` and `derToRawSignature` were internal and are gone too.
