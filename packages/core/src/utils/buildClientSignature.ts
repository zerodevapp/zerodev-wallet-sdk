import type { ApiKeyStamper } from '../stampers/types.js'
import { derToRawSignature } from './derToRawSignature.js'

export type BuildClientSignatureParams = {
  /** The verification token JWT from Auth Proxy's verifyOtp */
  verificationToken: string
  /** The compressed public key hex */
  publicKey: string
  /** The API key stamper for signing */
  stamper: ApiKeyStamper
}

/**
 * Builds a client signature for OTP login.
 *
 * Steps:
 * 1. Decode verificationToken JWT to extract `id` field as tokenId
 * 2. Build message: JSON.stringify({ login: { publicKey }, tokenId, type: "USAGE_TYPE_LOGIN" })
 * 3. Sign message with stamper → get stampHeaderValue
 * 4. Parse stampHeaderValue → extract DER signature hex
 * 5. Convert DER to raw r||s format
 * 6. Return raw signature hex
 *
 * @param params - The parameters for building the client signature
 * @returns The raw r||s signature hex (64 bytes = 128 chars)
 */
export async function buildClientSignature(
  params: BuildClientSignatureParams,
): Promise<string> {
  const { verificationToken, publicKey, stamper } = params

  // Step 1: Extract tokenId from verification token JWT payload
  const tokenId = extractTokenIdFromJwt(verificationToken)

  // Step 2: Build the signature payload message
  const signaturePayload = {
    login: { publicKey },
    tokenId,
    type: 'USAGE_TYPE_LOGIN',
  }
  const message = JSON.stringify(signaturePayload)

  // Step 3: Sign the message using the stamper
  const stamp = await stamper.stamp(message)

  // Step 4: Parse the stamp to extract the DER signature
  // The stampHeaderValue is base64url encoded JSON containing the signature
  const stampData = JSON.parse(base64UrlDecode(stamp.stampHeaderValue))
  const derSignatureHex: string = stampData.signature

  // Step 5: Convert DER signature to raw r||s format
  const rawSignature = derToRawSignature(derSignatureHex)

  // Step 6: Return raw signature hex
  return rawSignature
}

/**
 * Extracts the token ID (id field) from a JWT's payload
 */
function extractTokenIdFromJwt(jwt: string): string {
  const parts = jwt.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  const payload = JSON.parse(base64UrlDecode(parts[1]!))
  if (!payload.id) {
    throw new Error('JWT payload missing id field')
  }

  return payload.id
}

/**
 * Decodes a base64url encoded string
 */
function base64UrlDecode(str: string): string {
  // Add padding if necessary
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padding = base64.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }
  return atob(base64)
}
