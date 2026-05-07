import type { Client } from '../../client/types.js'

export type GetOAuthLoginUrlParameters = {
  /** OAuth provider — currently only `'google'` is supported. */
  provider: 'google'
  /** The project ID for the request. */
  projectId: string
  /**
   * The session public key (compressed P-256 hex, lowercase, with or
   * without `0x` prefix). The backend embeds `sha256(utf8(hex))` as the
   * OIDC `nonce` so the SDK can verify the URL was minted for this key.
   */
  publicKey: string
  /**
   * Where the popup should land after the OAuth round-trip
   * (e.g. `https://app.example.com/dashboard?oauth_success=true`).
   * Must be on the project's whitelist.
   */
  returnTo: string
}

export type GetOAuthLoginUrlReturnType = string

/**
 * Fetches the Google OAuth authorization URL from the backend.
 *
 * The SDK must verify the returned URL's `nonce` against
 * `sha256(utf8(publicKey))` (and the host is `accounts.google.com`)
 * before opening it in a popup — the backend is not a trusted party.
 * See audit finding TOB-KMS-1.
 */
export async function getOAuthLoginUrl(
  client: Client,
  params: GetOAuthLoginUrlParameters,
): Promise<GetOAuthLoginUrlReturnType> {
  if (params.provider !== 'google') {
    throw new Error(`Unsupported OAuth provider: ${params.provider}`)
  }
  const query = new URLSearchParams({
    project_id: params.projectId,
    pub_key: params.publicKey.replace(/^0x/, '').toLowerCase(),
    return_to: params.returnTo,
  })
  return await client.request<string>({
    path: `oauth/google/login-url?${query.toString()}`,
    method: 'GET',
  })
}
