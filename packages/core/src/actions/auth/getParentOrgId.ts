import type { Client } from '../../client/types.js'

export type GetParentOrgIdReturnType = {
  /** The Turnkey parent (base) organization ID configured on the backend. */
  parentOrgId: string
}

/**
 * Fetches the Turnkey parent (base) organization ID from the backend.
 *
 * Passkey and session-key stamp logins name this org, and the backend resolves
 * the sub-org from the credential; an OTP login names the sub-org `verifyOTP`
 * returned instead. The SDK fetches it (rather than hardcoding) so it works
 * across environments (prod/staging/local) without a per-env override.
 *
 * Corresponds to `GET /api/v1/server-info/parent-org-id`.
 */
export async function getParentOrgId(
  client: Client,
): Promise<GetParentOrgIdReturnType> {
  return await client.request({
    path: 'server-info/parent-org-id',
    method: 'GET',
  })
}
