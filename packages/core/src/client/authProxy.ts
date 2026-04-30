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
  /**
   * HPKE-sealed bundle containing `{otp_code, public_key}` encrypted to the
   * enclave's per-session target key. Produced by `encryptOtpAttempt`.
   */
  encryptedOtpBundle: string
}

export type AuthProxyVerifyOtpResponse = {
  /** The verification token to use for login */
  verificationToken: string
}

/**
 * Creates an Auth Proxy client for making requests to Turnkey's Auth Proxy
 *
 * Note: This client only handles OTP verification. The actual OTP login
 * is handled by the backend (/auth/login/otp) which manages sub-organization
 * creation and session handling.
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
     * Verifies an OTP attempt with Turnkey's Auth Proxy.
     *
     * The `encryptedOtpBundle` is HPKE-sealed `{otp_code, public_key}` JSON
     * (see `encryptOtpAttempt`). The auth proxy forwards the ciphertext to
     * the TLS Fetcher enclave, which decrypts it, verifies the OTP code, and
     * returns a `verificationToken` bound to the embedded public key.
     *
     * Pass the returned `verificationToken` to `/auth/login/otp` along with
     * a client signature to complete the login.
     */
    async verifyOtp(
      params: AuthProxyVerifyOtpRequest,
    ): Promise<AuthProxyVerifyOtpResponse> {
      return request<AuthProxyVerifyOtpResponse>('/v1/otp_verify_v2', params)
    },
  }
}

export type AuthProxyClient = ReturnType<typeof createAuthProxyClient>
