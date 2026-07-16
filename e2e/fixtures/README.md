# E2E Test Fixtures

## `test-otp-bundle.json` + `test-signer-public-key.txt`

These two files are used by Playwright tests when `USE_REAL_EMAIL=false` (the default for PR CI and local runs). They allow the tests to bypass Turnkey's pinned production signing key without hitting a real email inbox.

### How they are used

- `test-otp-bundle.json` is returned by the mocked `registerWithOTP` response via `page.route()`. It is a valid `EncryptionTargetEnvelope` signed with a test key pair rather than Turnkey's production key.
- `test-signer-public-key.txt` contains the `enclaveQuorumPublic` hex for that test key pair. It is injected into the demo app at build time as `NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY` so `encryptOtpAttempt` accepts the test bundle.

Both files are committed. The private key that signed them is not stored anywhere — it is discarded after generation and is not needed again unless you regenerate.

### When to regenerate

Regenerate (and commit both files) when any of the following change:

- The `encryptOtpAttempt` validation logic (new bundle version, different algorithm, extra required fields)
- The `EncryptionTargetEnvelope` type shape in `packages/core/src/utils/encryptOtpAttempt.ts`
- `@noble/curves` is upgraded to a version with a breaking API change that causes existing fixtures to fail verification

### How to regenerate

From the repo root:

```bash
pnpm tsx e2e/scripts/generate-test-otp-bundle.ts
```

Commit both output files. CI reads the public key at build time:

```bash
NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY=$(cat e2e/fixtures/test-signer-public-key.txt)
```
