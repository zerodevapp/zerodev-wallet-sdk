---
"@zerodev/wallet-core": patch
"@zerodev/wallet-react": patch
"@zerodev/wallet-react-kit": patch
---

Adapt to doorway-kms backend auth changes:
  - getAuthenticators and getUserWallet now use GET with an X-Timestamp + stamp header (new `timestamp` stamp position) to match StampCheckUser
  - OTP code length and the magic-link URL template are now configured per-project on the backend; drop the client-supplied `otpCodeCustomization` /
  `emailCustomization`, the magic-link `redirectURL`, and react-kit's `magicLinkBaseUrl`
