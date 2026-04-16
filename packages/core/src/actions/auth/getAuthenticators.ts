import type { Client } from '../../client/types.js'

export type GetAuthenticatorsParameters = {
  /** The sub-organization ID to query authenticators for */
  subOrganizationId: string
  /** The project ID for the request */
  projectId: string
  /** The session token for authorization */
  token: string
}

/** An OAuth authenticator linked to the user (PascalCase from Go default marshaling) */
export type OAuthAuthenticator = {
  Provider?: string
  ClientId?: string
  Subject?: string
  [key: string]: unknown
}

/** A passkey (WebAuthn) authenticator (PascalCase from Go default marshaling) */
export type PasskeyAuthenticator = {
  RpId?: string
  PublicKey?: string
  CredentialId?: string
  [key: string]: unknown
}

/** An email contact linked to the user (PascalCase from Go default marshaling) */
export type EmailContact = {
  Email?: string
  [key: string]: unknown
}

/** An API key authenticator (PascalCase from Go default marshaling) */
export type ApiKeyAuthenticator = {
  ApiKey?: string
  [key: string]: unknown
}

export type GetAuthenticatorsReturnType = {
  /** OAuth providers linked to the user (null if none) */
  oauths: OAuthAuthenticator[] | null
  /** Passkey authenticators registered for the user (null if none) */
  passkeys: PasskeyAuthenticator[] | null
  /** Email contacts associated with the user (null if none) */
  emailContacts: EmailContact[] | null
  /** API keys associated with the user (null if none) */
  apiKeys: ApiKeyAuthenticator[] | null
}

/**
 * Fetches all authenticators (oauths, passkeys, emailContacts, apiKeys) for
 * the authenticated user within the given project/sub-organization.
 *
 * Corresponds to `POST /api/v1/{projectId}/authenticators`.
 *
 * @param client - The ZeroDev Wallet client
 * @param params - The parameters for the authenticators request
 * @returns The user's authenticators grouped by type
 *
 * @example
 * ```ts
 * const authenticators = await getAuthenticators(client, {
 *   subOrganizationId: 'suborg_123',
 *   projectId: 'proj_456',
 *   token: 'session_token_abc',
 * });
 * console.log(authenticators.oauths, authenticators.passkeys);
 * ```
 */
export async function getAuthenticators(
  client: Client,
  params: GetAuthenticatorsParameters,
): Promise<GetAuthenticatorsReturnType> {
  const { subOrganizationId, projectId, token } = params

  return await client.request({
    path: `${projectId}/authenticators`,
    method: 'POST',
    body: {
      subOrganizationId,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
    stamp: true,
    stampPostion: 'headers',
  })
}
