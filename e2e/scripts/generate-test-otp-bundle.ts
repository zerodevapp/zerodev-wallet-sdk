/**
 * Generates test P-256 fixtures used to bypass Turnkey's pinned signing key
 * during Playwright E2E tests (USE_REAL_EMAIL=false mode).
 *
 * Outputs (both must be committed to the repo):
 *   e2e/fixtures/test-otp-bundle.json          — signed EncryptionTargetEnvelope returned
 *                                                 by the mocked registerWithOTP response
 *   e2e/fixtures/test-signer-public-key.txt    — enclaveQuorumPublic hex; passed to the
 *                                                 demo app as NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY
 *                                                 so encryptOtpAttempt accepts the test bundle
 *
 * ── When to regenerate ───────────────────────────────────────────────────────
 *
 * Run this script again (and commit both output files) whenever:
 *   1. The `encryptOtpAttempt` validation logic changes — e.g. a new bundle
 *      version string, a different signature algorithm, or extra required fields.
 *   2. The `EncryptionTargetEnvelope` type in encryptOtpAttempt.ts changes shape.
 *   3. @noble/curves is upgraded to a version with a breaking API change that
 *      causes the verification step to reject existing fixtures.
 *
 * The private key is NOT committed and does NOT need to be preserved —
 * fresh key pairs are generated on every run. The only thing that must stay
 * in sync is: the public key in test-signer-public-key.txt matches the key
 * that signed test-otp-bundle.json (they are always produced together).
 *
 * ── How to regenerate ────────────────────────────────────────────────────────
 *
 *   pnpm tsx e2e/scripts/generate-test-otp-bundle.ts
 *
 * Then commit BOTH output files. The CI workflow reads the public key at
 * build time: NEXT_PUBLIC_DANGEROUS_OTP_SIGNER_KEY=$(cat e2e/fixtures/test-signer-public-key.txt)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The @noble packages are resolved from packages/core/node_modules where
 * they are already installed as production dependencies — no extra installs needed.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve @noble packages from packages/core/node_modules where they are installed.
// This script lives at e2e/scripts/, so ../../packages/core/node_modules is correct.
const coreNodeModules = resolve(__dirname, '../../packages/core/node_modules')

const { p256 } = (await import(
  pathToFileURL(resolve(coreNodeModules, '@noble/curves/nist.js')).href
)) as typeof import('@noble/curves/nist.js')

const { bytesToHex } = (await import(
  pathToFileURL(resolve(coreNodeModules, '@noble/hashes/utils.js')).href
)) as typeof import('@noble/hashes/utils.js')

// 1. Generate the test signer key pair (replaces the pinned production key in tests)
const signerKeypair = p256.keygen()
const signerPrivKey = signerKeypair.secretKey
const signerPubKeyBytes = p256.getPublicKey(signerPrivKey, false) // uncompressed, 65 bytes
const signerPubKeyHex = bytesToHex(signerPubKeyBytes)

// 2. Generate the HPKE target key pair (represents the enclave's ephemeral key)
const targetKeypair = p256.keygen()
const targetPrivKey = targetKeypair.secretKey
const targetPubKeyBytes = p256.getPublicKey(targetPrivKey, false) // uncompressed, 65 bytes
const targetPubKeyHex = bytesToHex(targetPubKeyBytes)

// 3. Build the signed data JSON and hex-encode its UTF-8 bytes
const signedDataJson = JSON.stringify({
  targetPublic: targetPubKeyHex,
  organizationId: 'test-org-id',
  userId: 'test-user-id',
})
const dataBytes = new TextEncoder().encode(signedDataJson)
const dataHex = bytesToHex(dataBytes)

// 4. Sign the raw data bytes with the signer private key (sha256 prehash, DER format).
// In @noble/curves v2.x, p256.sign() returns a Uint8Array; passing format:'der' produces
// ASN.1 DER output directly, which is what encryptOtpAttempt verifies with format:'der'.
const signatureBytes = p256.sign(dataBytes, signerPrivKey, {
  prehash: true,
  lowS: true,
  format: 'der',
})
const dataSignatureHex = bytesToHex(signatureBytes)

// 5. Assemble the envelope matching EncryptionTargetEnvelope in encryptOtpAttempt.ts
const envelope = {
  version: 'v1.0.0',
  data: dataHex,
  dataSignature: dataSignatureHex,
  enclaveQuorumPublic: signerPubKeyHex,
}

// 6. Write fixtures
const fixturesDir = resolve(__dirname, '..', 'fixtures')
mkdirSync(fixturesDir, { recursive: true })

const bundlePath = resolve(fixturesDir, 'test-otp-bundle.json')
writeFileSync(bundlePath, JSON.stringify(envelope, null, 2), 'utf-8')

const signerKeyPath = resolve(fixturesDir, 'test-signer-public-key.txt')
writeFileSync(signerKeyPath, signerPubKeyHex, 'utf-8')

console.log('Generated test OTP bundle fixtures:')
console.log(`  ${bundlePath}`)
console.log(`  ${signerKeyPath}`)
console.log(
  `Signer public key (first 32 chars): ${signerPubKeyHex.slice(0, 32)}...`,
)
