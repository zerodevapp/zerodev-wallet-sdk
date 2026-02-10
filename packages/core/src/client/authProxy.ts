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
     * Verifies an OTP code with Turnkey's Auth Proxy
     *
     * Returns a verificationToken that should be passed to the backend's
     * /auth/login/otp endpoint along with a client signature.
     */
    async verifyOtp(
      params: AuthProxyVerifyOtpRequest,
    ): Promise<AuthProxyVerifyOtpResponse> {
      return request<AuthProxyVerifyOtpResponse>('/v1/otp_verify', params)
    },
  }
}

export type AuthProxyClient = ReturnType<typeof createAuthProxyClient>
