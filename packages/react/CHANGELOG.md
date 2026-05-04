# @zerodev/wallet-react

## 0.0.1-alpha.20

### Patch Changes

- feat(otp): switch to encrypted OTP flow (Turnkey `INIT_OTP_V3` / `VERIFY_OTP_V2`)

  The OTP code and client public key are now HPKE-sealed to a per-session enclave key before being sent to the auth proxy. A compromised proxy can no longer substitute its own public key without knowing the OTP.

  **Breaking changes** (alpha):

  - `registerWithOTP` now returns `{ otpId, otpEncryptionTargetBundle }`. Pass `otpEncryptionTargetBundle` verbatim to the verify step.
  - `useSendOTP` / `useSendMagicLink` results include `otpEncryptionTargetBundle`.
  - `useVerifyOTP` / `useVerifyMagicLink` variables now require `otpEncryptionTargetBundle`.
  - `AuthParams` `otp.verifyOtp` and `magicLink.verify` variants require `otpEncryptionTargetBundle`.
  - Auth-proxy endpoint `/v1/otp_verify` → `/v1/otp_verify_v2`; request body switched from `{otpId, otpCode, public_key}` to `{otpId, encryptedOtpBundle}`.

  Requires the doorway-kms backend running on the `upgrade_turnkey` branch (or later release that adopts `tkhq/go-sdk@v0.17.0`).

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.18

## 0.0.1-alpha.19

### Patch Changes

- fix(react): preserve caller's pathname in OAuth `returnTo` so the popup lands on the same route as the parent. Previously the SDK used `window.location.origin` only, which redirected the popup to `/`. If `/` rendered a different app (or no SDK provider), the OAuth callback handler never ran and the popup hung.

## 0.0.1-alpha.18

### Patch Changes

- fix: update authenticator types to camelCase
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.17

## 0.0.1-alpha.17

### Patch Changes

- feat: support get-authenticators and remove get-email api
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.16

## 0.0.1-alpha.16

### Patch Changes

- feat: switch signing to validated backend endpoints
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.15

## 0.0.1-alpha.15

### Patch Changes

- feat: replace cookie-based OAuth with server-side session ID
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.14

## 0.0.1-alpha.14

### Patch Changes

- Add optional `otpCodeCustomization` parameter to OTP and magic link send flows for configuring code length (6-9) and alphanumeric mode
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.13

## 0.0.1-alpha.13

### Patch Changes

- feat: expose applySettings on iframe stamper and accept iframeStyles in export actions
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.12

## 0.0.1-alpha.12

### Patch Changes

- fix: resolve session token dynamically so signing survives session refresh
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.11

## 0.0.1-alpha.11

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.10

## 0.0.1-alpha.10

### Patch Changes

- fix: use session.token for getUserEmail auth headers
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.9

## 0.0.1-alpha.9

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.8

## 0.0.1-alpha.8

### Patch Changes

- fix: use internal state for get user email

## 0.0.1-alpha.7

### Patch Changes

- Add OTP authentication via Turnkey Auth Proxy
- Add OAuth backend PKCE flow
- Add getUserEmail method and React hook
- Fix passkey login endpoint
- Fix signature verification with JSON canonicalization
- Rename turnkeySession to session in OAuth response
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.7

## 0.0.1-alpha.6

### Patch Changes

- feat: Added private key export feature
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.6

## 0.0.1-alpha.5

### Patch Changes

- refactor: Simplify chain state management by replacing chainIds array with activeChainId

## 0.0.1-alpha.4

### Patch Changes

- fix: kernel instance reinitialisation

## 0.0.1-alpha.3

### Patch Changes

- fix: removed lazy initialization of ZD wallet core

## 0.0.1-alpha.2

### Patch Changes

- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.5

## 0.0.1-alpha.1

### Patch Changes

- feat: changed default aaUrl to staging url

## 0.0.1-alpha.0

### Patch Changes

- feat: @zerodev/wallet-react initial release
- Updated dependencies
  - @zerodev/wallet-core@0.0.1-alpha.4
