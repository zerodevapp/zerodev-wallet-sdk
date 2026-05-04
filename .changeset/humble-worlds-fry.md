---
"@zerodev/wallet-core": patch
"@zerodev/wallet-react": patch
---

feat(otp): switch to encrypted OTP flow (Turnkey `INIT_OTP_V3` / `VERIFY_OTP_V2`)

The OTP code and client public key are now HPKE-sealed to a per-session enclave key before being sent to the auth proxy. A compromised proxy can no longer substitute its own public key without knowing the OTP.

**Breaking changes** (alpha):

- `registerWithOTP` now returns `{ otpId, otpEncryptionTargetBundle }`. Pass `otpEncryptionTargetBundle` verbatim to the verify step.
- `useSendOTP` / `useSendMagicLink` results include `otpEncryptionTargetBundle`.
- `useVerifyOTP` / `useVerifyMagicLink` variables now require `otpEncryptionTargetBundle`.
- `AuthParams` `otp.verifyOtp` and `magicLink.verify` variants require `otpEncryptionTargetBundle`.
- Auth-proxy endpoint `/v1/otp_verify` → `/v1/otp_verify_v2`; request body switched from `{otpId, otpCode, public_key}` to `{otpId, encryptedOtpBundle}`.

Requires the doorway-kms backend running on the `upgrade_turnkey` branch (or later release that adopts `tkhq/go-sdk@v0.17.0`).