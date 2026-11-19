import type { Client } from '../../client/types.js'

export type GetXLoginUrlParameters = {
  /** The project ID for the request. */
  projectId: string
  /**
   * The session public key (compressed P-256 hex, lowercase, with or
   * without `0x` prefix). The backend embeds `sha256(utf8(hex))` as the
   * `nonce` on the X authorize URL.
   */
  publicKey: string
  /**
   * Where the popup should land after the OAuth round-trip. Must be on the
   * project's whitelist, or a relative path.
   */
  returnTo: string
}

export type GetXLoginUrlReturnType = string

/**
 * Fetches the X (Twitter) OAuth authorization URL from the backend.
 *
 * The caller must verify the returned URL's host is `x.com` and its
 * `nonce` equals `sha256(utf8(publicKey))` before opening it.
 */
export async function getXLoginUrl(
  client: Client,
  params: GetXLoginUrlParameters,
): Promise<GetXLoginUrlReturnType> {
  const query = new URLSearchParams({
    project_id: params.projectId,
    pub_key: params.publicKey.replace(/^0x/, '').toLowerCase(),
    return_to: params.returnTo,
  })
  return await client.request<string>({
    path: `oauth/x/login-url?${query.toString()}`,
    method: 'GET',
  })
}
