import type { IndexedDbStamper } from '../stampers/types.js'
import { derToRawSignature } from '../utils/derToRawSignature.js'

const AUTH_PROXY_BASE_URL = 'https://authproxy.turnkey.com'

export type AuthProxyClientConfig = {
  /** The Auth Proxy Config ID from the backend */
  authProxyConfigId: string
  /** Optional base URL override (for testing) */
  baseUrl?: string
}

export type AuthProxyVerifyOtpRequest = {
  /** The OTP ID from registration */
  otpId: string
  /** The OTP code entered by the user */
  otpCode: string
  /** The public key to associate with the verification */
  public_key: string
}

export type AuthProxyVerifyOtpResponse = {
  /** The verification token to use for login */
  verificationToken: string
}

export type AuthProxyOtpLoginRequest = {
  /** The verification token from verify step */
  verificationToken: string
  /** The public key to create session for */
  publicKey: string
  /** The organization ID (subOrganizationId) */
  organizationId: string
  /** The client signature for authentication */
  client_signature: ClientSignature
}

export type ClientSignature = {
  /** JSON stringified SignaturePayload */
  message: string
  /** Compressed public key hex */
  publicKey: string
  /** The signature scheme */
  scheme: 'CLIENT_SIGNATURE_SCHEME_API_P256'
  /** Raw r||s hex (64 bytes each = 128 chars total) */
  signature: string
}

export type SignaturePayload = {
  /** Login information */
  login: { publicKey: string }
  /** Token ID extracted from verificationToken JWT */
  tokenId: string
  /** Usage type */
  type: 'USAGE_TYPE_LOGIN'
}

export type AuthProxyOtpLoginResponse = {
  /** The session token */
  session: string
}

/** Parameters for the simplified otpLogin method */
export type OtpLoginParams = {
  /** The verification token from verifyOtp */
  verificationToken: string
  /** The public key to create session for */
  publicKey: string
  /** The organization ID (subOrganizationId from sendOTP) */
  organizationId: string
  /** The IndexedDB stamper for signing the request */
  stamper: IndexedDbStamper
}

/**
 * Creates an Auth Proxy client for making requests to Turnkey's Auth Proxy
 */
export function createAuthProxyClient(config: AuthProxyClientConfig) {
  const { authProxyConfigId, baseUrl = AUTH_PROXY_BASE_URL } = config

  async function request<T>(
    path: string,
    body: unknown,
    method: 'POST' | 'GET' = 'POST',
  ): Promise<T> {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Proxy-Config-Id': authProxyConfigId,
      },
    }

    if (method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(`${baseUrl}${path}`, fetchOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Auth Proxy request failed: ${response.status} ${response.statusText} - ${errorText}`,
      )
    }

    return response.json()
  }

  return {
    /**
     * Verifies an OTP code with Turnkey's Auth Proxy
     */
    async verifyOtp(
      params: AuthProxyVerifyOtpRequest,
    ): Promise<AuthProxyVerifyOtpResponse> {
      return request<AuthProxyVerifyOtpResponse>('/v1/otp_verify', params)
    },

    /**
     * Logs in with a verified OTP via Turnkey's Auth Proxy
     * This method handles building the client signature automatically
     */
    async otpLogin(params: OtpLoginParams): Promise<AuthProxyOtpLoginResponse> {
      const { verificationToken, publicKey, organizationId, stamper } = params

      // Extract tokenId from verification token JWT payload
      const tokenId = extractTokenIdFromJwt(verificationToken)

      // Build the signature payload
      const signaturePayload: SignaturePayload = {
        login: { publicKey },
        tokenId,
        type: 'USAGE_TYPE_LOGIN',
      }

      const message = JSON.stringify(signaturePayload)

      // Sign the message using the stamper
      const stamp = await stamper.stamp(message)

      // Parse the stamp to extract the signature
      // The stampHeaderValue is base64url encoded JSON containing the signature
      const stampData = JSON.parse(base64UrlDecode(stamp.stampHeaderValue))
      const derSignatureHex: string = stampData.signature

      // Convert DER signature to raw r||s format
      const rawSignature = derToRawSignature(derSignatureHex)

      // Build the client signature
      const clientSignature: ClientSignature = {
        message,
        publicKey,
        scheme: 'CLIENT_SIGNATURE_SCHEME_API_P256',
        signature: rawSignature,
      }

      return request<AuthProxyOtpLoginResponse>('/v1/otp_login', {
        verificationToken,
        publicKey,
        organizationId,
        client_signature: clientSignature,
      })
    },
  }
}

export type AuthProxyClient = ReturnType<typeof createAuthProxyClient>

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
