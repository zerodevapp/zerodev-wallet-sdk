import type { Client } from '../../client/types.js'
import type { SigningStamper } from '../../stampers/types.js'

/**
 * The wallet set's sub-organization ID for a request: the one passed in the
 * call, else the one the client was created with. Every server action targets
 * the same wallet set, so callers rarely need to repeat it.
 */
export function resolveOrganizationId(
  client: Client<undefined, SigningStamper>,
  params: { organizationId?: string },
  action: string,
): string {
  const organizationId = params.organizationId ?? client.organizationId
  if (!organizationId) {
    throw new Error(
      `${action} needs an organizationId: pass it in params or on the client.`,
    )
  }
  return organizationId
}
