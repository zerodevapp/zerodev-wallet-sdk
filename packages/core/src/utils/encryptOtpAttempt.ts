/**
 * Wraps the OTP code + client public key in a Turnkey-compatible HPKE bundle
 * for the `/v1/otp_verify_v2` auth-proxy endpoint.
 *
 * Bundle flow (RFC 9180 mode_base over Turnkey's TLS Fetcher enclave):
 *   1. The backend's /init/otp returns a signed envelope that contains an
 *      ephemeral HPKE public key (`targetPublic`) generated fresh by the
 *      enclave for this OTP attempt.
 *   2. We verify the envelope's ECDSA signature against a pinned production
 *      key (`TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY`) so a compromised proxy
 *      cannot substitute its own ephemeral key.
 *   3. We HPKE-seal `{otp_code, public_key}` to `targetPublic`. The auth proxy
 *      forwards the ciphertext to the enclave; only the enclave can decrypt
 *      it. The enclave then issues a `verificationToken` bound to the public
 *      key embedded in the plaintext.
 *
 * See: tkhq/go-sdk `examples/email_otp` and `pkg/enclave_encrypt`.
 */

import { p256 } from '@noble/curves/nist.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY } from '../constants.js'
import { hpkeSealP256 } from './hpke.js'

const BUNDLE_DATA_VERSION = 'v1.0.0'

type EncryptionTargetEnvelope = {
  version: string
  /** Hex-encoded JSON: `{ targetPublic, organizationId, userId? }` */
  data: string
  /** Hex-encoded ECDSA-P256 signature over the raw `data` bytes (DER). */
  dataSignature: string
  /** Hex-encoded uncompressed P-256 pubkey of the signing enclave. */
  enclaveQuorumPublic: string
}

type SignedTargetData = {
  targetPublic: string
  organizationId?: string
  userId?: string
}

export type EncryptOtpAttemptParams = {
  /** The OTP code the user entered. */
  otpCode: string
  /**
   * The client's session public key (compressed P-256 hex). The enclave binds
   * this key into the `verificationToken` it issues.
   */
  publicKey: string
  /** The signed envelope returned by `/auth/init/otp`. */
  encryptionTargetBundle: string
  /**
   * Test-only override for the pinned signing key. Production callers should
   * leave this undefined; it exists so tests don't have to use the real key.
   */
  dangerouslyOverrideSignerPublicKey?: string
}

/**
 * Returns a JSON string ready to be sent as `encryptedOtpBundle` on
 * `POST /v1/otp_verify_v2`.
 */
export async function encryptOtpAttempt({
  otpCode,
  publicKey,
  encryptionTargetBundle,
  dangerouslyOverrideSignerPublicKey,
}: EncryptOtpAttemptParams): Promise<string> {
  const expectedSignerHex =
    dangerouslyOverrideSignerPublicKey ?? TURNKEY_TLS_FETCHER_SIGN_PUBLIC_KEY

  let envelope: EncryptionTargetEnvelope
  try {
    envelope = JSON.parse(encryptionTargetBundle)
  } catch (err) {
    throw new Error(
      `encryptOtpAttempt: failed to parse encryption target bundle: ${(err as Error).message}`,
    )
  }

  if (envelope.version !== BUNDLE_DATA_VERSION) {
    throw new Error(
      `encryptOtpAttempt: unsupported bundle version ${envelope.version}`,
    )
  }

  if (
    envelope.enclaveQuorumPublic.toLowerCase() !==
    expectedSignerHex.toLowerCase()
  ) {
    throw new Error(
      'encryptOtpAttempt: enclave quorum public key does not match pinned signing key',
    )
  }

  const dataBytes = hexToBytes(envelope.data)
  const signatureBytes = hexToBytes(envelope.dataSignature)
  const signerPublicKeyBytes = hexToBytes(envelope.enclaveQuorumPublic)

  // The Go side does sha256(data) then ASN.1 DER ECDSA verify, without
  // enforcing low-S. Match that here.
  const valid = p256.verify(signatureBytes, dataBytes, signerPublicKeyBytes, {
    prehash: true,
    format: 'der',
    lowS: false,
  })
  if (!valid) {
    throw new Error('encryptOtpAttempt: invalid enclave signature on bundle')
  }

  let signedData: SignedTargetData
  try {
    signedData = JSON.parse(new TextDecoder().decode(dataBytes))
  } catch (err) {
    throw new Error(
      `encryptOtpAttempt: failed to parse signed bundle data: ${(err as Error).message}`,
    )
  }
  if (!signedData.targetPublic) {
    throw new Error('encryptOtpAttempt: missing targetPublic in signed data')
  }

  const targetPublicKey = hexToBytes(signedData.targetPublic)

  // Plaintext shape matches what the Go example marshals:
  //   { otp_code: string, public_key: string }
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ otp_code: otpCode, public_key: publicKey }),
  )

  const { encappedPublic, ciphertext } = await hpkeSealP256({
    receiverPublicKey: targetPublicKey,
    plaintext,
  })

  // Wire format = the Go SDK's `ClientSendMsg`: Bytes fields hex-encoded.
  return JSON.stringify({
    encappedPublic: bytesToHex(encappedPublic),
    ciphertext: bytesToHex(ciphertext),
  })
}
