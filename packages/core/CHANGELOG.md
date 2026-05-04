# @zerodev/wallet-core

## 0.0.1-alpha.18

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

## 0.0.1-alpha.17

### Patch Changes

- fix: update authenticator types to camelCase

## 0.0.1-alpha.16

### Patch Changes

- feat: support get-authenticators and remove get-email api

## 0.0.1-alpha.15

### Patch Changes

- feat: switch signing to validated backend endpoints

## 0.0.1-alpha.14

### Patch Changes

- feat: replace cookie-based OAuth with server-side session ID

## 0.0.1-alpha.13

### Patch Changes

- Add optional `otpCodeCustomization` parameter to OTP and magic link send flows for configuring code length (6-9) and alphanumeric mode

## 0.0.1-alpha.12

### Patch Changes

- feat: expose applySettings on iframe stamper and accept iframeStyles in export actions

## 0.0.1-alpha.11

### Patch Changes

- fix: resolve session token dynamically so signing survives session refresh

## 0.0.1-alpha.10

### Patch Changes

- feat: Added new getAuthProxyConfigId action that fetches the auth proxy config ID from GET /server-info/auth-proxy-id and updated DEFAULT_ORGANIZATION_ID and KMS_SERVER_URL to staging environment

## 0.0.1-alpha.9

### Patch Changes

- fix: use session.token for getUserEmail auth headers

## 0.0.1-alpha.8

### Patch Changes

- fix: get user email stamp position

## 0.0.1-alpha.7

### Patch Changes

- Add OTP authentication via Turnkey Auth Proxy
- Add OAuth backend PKCE flow
- Add getUserEmail method and React hook
- Fix passkey login endpoint
- Fix signature verification with JSON canonicalization
- Rename turnkeySession to session in OAuth response

## 0.0.1-alpha.6

### Patch Changes

- feat: Added private key export feature

## 0.0.1-alpha.5

### Patch Changes

- feat: audit fixes

## 0.0.1-alpha.4

### Patch Changes

- feat: @zerodev/wallet-react initial release

## 0.0.1-alpha.3

### Patch Changes

- Package renamed from @zerodev/signer-core to @zerodev/wallet-core and likewise changes in utils

## 0.0.1-alpha.2

### Patch Changes

- feat: added export wallet util

## 0.0.1-alpha.1

### Patch Changes

- feat: added otp with email magic link support and removed legacy email magic link (iframe) auth option

## 0.0.1-alpha.0

### Patch Changes

- feat: initial alpha release
